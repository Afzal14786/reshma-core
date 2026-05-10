import { Worker, Job } from "bullmq";
import env from "@config/env";
import { Order } from "@modules/orders/order.model";
import { generateInvoiceBuffer } from "@modules/orders/invoice.generator";
// FIXED: Importing the configured instance from your config, not the raw module
import cloudinary from "@config/cloudinary";
import logger from "@config/logger";
import { IInvoiceJobData } from "./invoice.queue";
import { IOrder } from "@modules/orders/interfaces/order.interface";

const redisUrl = new URL(env.REDIS_URL);

/**
 * ARCHITECTURE NOTE: The Invoice Worker Engine
 * This worker completely offloads CPU-intensive PDFKit drawing operations
 * and network-heavy Cloudinary uploads from the main Node.js event loop.
 */
class InvoiceWorkerEngine {
  private worker: Worker;

  constructor() {
    // FIXED: Using 'string' for the JobName generic to align with exactOptionalPropertyTypes
    // and match the pattern established in email.worker.ts.
    this.worker = new Worker<IInvoiceJobData, void, string>(
      "invoice-generation",
      async (job: Job<IInvoiceJobData, void, string>) => {
        await this.processJob(job);
      },
      {
        connection: {
          host: redisUrl.hostname,
          port: Number(redisUrl.port) || 6379,
          password: env.REDIS_PASSWORD || redisUrl.password || undefined,
          ...(redisUrl.protocol === "rediss:" ? { tls: {} } : {}),
        },
        concurrency: 5, // Process up to 5 PDFs simultaneously
      },
    );

    this.initializeListeners();
  }

  /**
   * SECURITY UTILITY: CodeQL CWE-117 Neutralizer
   */
  private safeLog(message: string): string {
    return message.replace(/[\r\n]/g, "");
  }

  /**
   * @method uploadBufferToCloudinary
   */
  private uploadBufferToCloudinary(
    buffer: Buffer,
    orderNumber: string,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "reshma_invoices",
          public_id: `tax_invoice_${orderNumber}`,
          resource_type: "raw",
          format: "pdf",
        },
        (error, result) => {
          if (error)
            return reject(
              new Error(`Cloudinary Stream Error: ${error.message}`),
            );
          if (!result || !result.secure_url)
            return reject(new Error("Cloudinary returned an empty response."));
          resolve(result.secure_url);
        },
      );

      uploadStream.end(buffer);
    });
  }

  /**
   * @method processJob
   */
  private async processJob(
    job: Job<IInvoiceJobData, void, string>,
  ): Promise<void> {
    const { orderId } = job.data;
    const safeOrderId = String(orderId).replace(/[\r\n]/g, "");

    logger.info(
      this.safeLog(
        `[InvoiceWorker] Commencing PDF generation for Order: ${safeOrderId}`,
      ),
    );

    const order = (await Order.findById(safeOrderId)
      .populate("user", "email firstname")
      .lean()) as IOrder;

    if (!order) {
      throw new Error(`Critical: Order ${safeOrderId} not found in database.`);
    }

    if (order.invoiceUrl) {
      logger.info(
        this.safeLog(
          `[InvoiceWorker] Invoice already exists for Order ${safeOrderId}. Skipping.`,
        ),
      );
      return;
    }

    try {
      const pdfBuffer = await generateInvoiceBuffer(order);
      await job.updateProgress(50);

      const secureUrl = await this.uploadBufferToCloudinary(
        pdfBuffer,
        order.orderNumber,
      );
      await job.updateProgress(80);

      await Order.updateOne(
        { _id: order._id },
        { $set: { invoiceUrl: secureUrl } },
      );

      await job.updateProgress(100);
      logger.info(
        this.safeLog(
          `[InvoiceWorker] Successfully attached invoice to Order: ${order.orderNumber}`,
        ),
      );
    } catch (error) {
      const errMessage =
        error instanceof Error ? error.message : "Unknown Error";
      logger.error(
        this.safeLog(
          `[InvoiceWorker] Pipeline failed for Order ${order.orderNumber}: ${errMessage}`,
        ),
      );
      throw error;
    }
  }

  private initializeListeners(): void {
    this.worker.on("failed", (job, err) => {
      const jobId = job ? job.id : "unknown";
      logger.error(
        this.safeLog(
          `[InvoiceWorker] Job ${jobId} failed completely. Reason: ${err.message}`,
        ),
      );
    });
  }
}

export const invoiceWorker = new InvoiceWorkerEngine();

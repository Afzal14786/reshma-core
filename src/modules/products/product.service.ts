import { typesenseClient } from "@config/typesense";
import { Product } from "./models/base-product.model";
import { AppError } from "@shared/utils/app-error";
import { HTTP_STATUS } from "@shared/constant/http-codes";
import {
  uploadBufferToCloudinary,
  deleteFromCloudinary,
} from "@config/cloudinary";
import {
  CreateProductInput,
  UpdateProductInput,
} from "./dtos/product.admin.dto";
import { GetProductsQueryInput } from "./dtos/product.public.dto";
import { IBaseProduct } from "./interfaces/base-product.interface";
import logger from "@config/logger";

// audit logs
import { AuditLogService } from "@modules/audit-logs/audit-log.service";
import {
  AuditAction,
  AuditModule,
} from "@modules/audit-logs/audit-log.interface";
import { IAuditContext } from "@shared/utils/audit.utils";

// --- RESILIENCE INFRASTRUCTURE IMPORTS ---
import { Queue } from "bullmq";
import Redis from "ioredis";
import env from "@config/env";

/**
 * Enterprise Resilience: Search Sync Dead Letter Queue (DLQ)
 * If Typesense goes down, failed product syncs are pushed here.
 * A background worker will retry them with exponential backoff.
 */
const searchSyncConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});
export const searchSyncQueue = new Queue("search-sync-queue", {
  connection: searchSyncConnection,
});

/**
 * Strict typing for outbound Typesense synchronization payloads.
 * This guarantees we never send Mongoose-specific metadata (like __v or timestamps)
 * to the RAM cluster, preserving memory and preventing schema rejections.
 */
interface ITypesenseProductPayload {
  id: string; // Typesense strictly requires the primary key to be a string named 'id'
  itemType: string;
  sku: string;
  name: string;
  description: string;
  mainCategory: string;
  basePrice: number;
  tags: string[];
  images: string[];
}

/**
 * Product Service
 * Handles all database interactions, polymorphic document creation,
 * and Cloudinary image pipelines for the catalog.
 */
export class ProductService {
  /**
   * SECURITY UTILITY: CodeQL CWE-117 Neutralizer
   * @description Prevents CRLF Log Injection attacks by stripping control characters.
   */
  private static safeLog(message: string): string {
    return message.replace(/[\r\n]/g, "");
  }

  /**
   * Admin: Create a new Polymorphic Product
   * Features: Parallel Cloudinary uploads and Cloudinary Rollback
   * if the database transaction fails (e.g., Duplicate SKU).
   */
  public static async createProduct(
    payload: CreateProductInput,
    files: Express.Multer.File[],
    auditContext?: IAuditContext,
  ): Promise<IBaseProduct> {
    // Enforce Image Requirement
    if (!files || files.length === 0) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        "At least one product image must be uploaded.",
      );
    }

    // Parallel Cloudinary Uploads
    const uploadPromises = files.map((file) =>
      uploadBufferToCloudinary(
        file.buffer,
        `products/${payload.itemType.toLowerCase()}`,
      ),
    );

    const imageUrls = await Promise.all(uploadPromises);

    // Database Transaction with Distributed Rollback
    try {
      const productData = {
        ...payload,
        images: imageUrls,
      };

      const product = await Product.create(productData);

      // --- SEARCH SYNCHRONIZATION HOOK ---
      // Syncs to Typesense immediately after MongoDB successfully commits.
      await this.syncToSearchEngine(product as unknown as IBaseProduct);

      // --- audit log ---
      if (auditContext) {
        await AuditLogService.log({
          adminId: auditContext.adminId,
          adminEmail: auditContext.adminEmail,
          adminName: auditContext.adminName,
          action: AuditAction.CREATE,
          module: AuditModule.PRODUCT,
          targetId: String(product._id),
          targetName: product.name,
          payload: productData,
          ...(auditContext.ipAddress
            ? { ipAddress: auditContext.ipAddress }
            : {}),
          ...(auditContext.userAgent
            ? { userAgent: auditContext.userAgent }
            : {}),
        });
      }

      return product as unknown as IBaseProduct;
    } catch (error: unknown) {
      // ROLLBACK: If DB creation fails (e.g., duplicate SKU), delete the uploaded images
      // to prevent Cloudinary storage bloat (Orphaned Assets).
      const rollbackPromises = imageUrls.map((url) =>
        deleteFromCloudinary(url),
      );
      await Promise.allSettled(rollbackPromises); // Use allSettled so one failed deletion doesn't crash the others

      throw error; // Rethrow to the Global Error Handler
    }
  }

  /**
   * Public: Fetch Catalog with Advanced Querying
   * Implements Pagination, Filtering, and highly-optimized MongoDB Text Searching.
   */
  public static async getProducts(queryData: GetProductsQueryInput) {
    const { page, limit, sort, q, itemType, mainCategory, subCategory } =
      queryData;

    // Build the dynamic MongoDB Query Object safely using strict typing.
    const query: Record<string, unknown> = { isActive: true };

    // Text Search Optimization
    if (q) {
      query.$text = { $search: String(q) };
    }

    // Exact Match Filters
    if (itemType) query.itemType = { $eq: String(itemType) };
    if (mainCategory) query.mainCategory = { $eq: String(mainCategory) };
    if (subCategory) query.subCategory = { $eq: String(subCategory) };

    // Pagination Math
    const skip = (Number(page) - 1) * Number(limit);

    // Execute Queries in Parallel
    const [products, totalDocuments] = await Promise.all([
      Product.find(query)
        .sort(sort ? String(sort) : "-createdAt")
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Product.countDocuments(query),
    ]);

    return {
      products,
      meta: {
        total: totalDocuments,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(totalDocuments / Number(limit)),
      },
    };
  }

  /**
   * Public/Admin: Fetch a single Product by ID
   */
  public static async getProductById(productId: string): Promise<IBaseProduct> {
    const product = await Product.findOne({
      _id: { $eq: String(productId) },
      isActive: true,
    }).lean();

    if (!product) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        "The requested product could not be found or has been removed.",
      );
    }

    return product as unknown as IBaseProduct;
  }

  /**
   * Admin: Update Product Data
   * Performs a partial update. Mongoose will strictly validate the payload
   * against the correct discriminator schema based on the document's `itemType`.
   */
  public static async updateProduct(
    productId: string,
    payload: UpdateProductInput,
    auditContext?: IAuditContext,
  ): Promise<IBaseProduct> {
    // capture "before" state for audi logging
    let beforeProduct: IBaseProduct | null = null;
    if (auditContext) {
      beforeProduct = (await Product.findOne({
        _id: { $eq: String(productId) },
      }).lean()) as IBaseProduct | null;
    }

    const sanitizedPayload: Record<string, unknown> = Object.create(null);

    for (const [key, value] of Object.entries(payload)) {
      if (
        !key.startsWith("$") &&
        key !== "__proto__" &&
        key !== "constructor" &&
        key !== "prototype"
      ) {
        sanitizedPayload[key] = value;
      }
    }

    const updatedProduct = await Product.findOneAndUpdate(
      { _id: { $eq: String(productId) } },
      { $set: sanitizedPayload },
      { new: true, runValidators: true },
    ).lean();

    if (!updatedProduct) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, "Product not found.");
    }

    const baseProduct = updatedProduct as unknown as IBaseProduct;

    // We can safely read isActive directly since it is strictly defined on IBaseProduct
    if (baseProduct.isActive === false) {
      await this.removeFromSearchEngine(String(baseProduct._id));
    } else {
      await this.syncToSearchEngine(baseProduct);
    }

    // audit log
    if (auditContext && beforeProduct) {
      await AuditLogService.log({
        adminId: auditContext.adminId,
        adminEmail: auditContext.adminEmail,
        adminName: auditContext.adminName,
        action: AuditAction.UPDATE,
        module: AuditModule.PRODUCT,
        targetId: String(baseProduct._id),
        targetName: baseProduct.name,
        changes: {
          before: beforeProduct as unknown as Record<string, unknown>,
          after: baseProduct as unknown as Record<string, unknown>,
        },
        ...(auditContext.ipAddress
          ? { ipAddress: auditContext.ipAddress }
          : {}),
        ...(auditContext.userAgent
          ? { userAgent: auditContext.userAgent }
          : {}),
      });
    }

    return baseProduct;
  }

  /**
   * Admin: Soft Delete Product
   * We never permanently delete (`.deleteOne()`) products. Doing so would orphan
   * historical Order documents and break financial receipts. Instead, we hide them.
   */
  public static async softDeleteProduct(
    productId: string,
    auditContext?: IAuditContext,
  ): Promise<void> {
    // Capture the "before" state for audit logging
    let beforeProduct: IBaseProduct | null = null;
    let productName = "Unknown Product";
    if (auditContext) {
      beforeProduct = (await Product.findOne({
        _id: { $eq: String(productId) },
      }).lean()) as IBaseProduct | null;
      if (beforeProduct) {
        productName = beforeProduct.name;
      }
    }

    const result = await Product.findOneAndUpdate(
      { _id: { $eq: String(productId) } },
      { $set: { isActive: false } },
    );

    if (!result) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, "Product not found.");
    }

    // SEARCH SYNCHRONIZATION HOOK
    await this.removeFromSearchEngine(String(productId));

    if (auditContext) {
      await AuditLogService.log({
        adminId: auditContext.adminId,
        adminEmail: auditContext.adminEmail,
        adminName: auditContext.adminName,
        action: AuditAction.DELETE,
        module: AuditModule.PRODUCT,
        targetId: productId,
        targetName: productName,
        ...(auditContext.ipAddress
          ? { ipAddress: auditContext.ipAddress }
          : {}),
        ...(auditContext.userAgent
          ? { userAgent: auditContext.userAgent }
          : {}),
      });
    }
  }

  /**
   * Internal: Reserve Stock Atomically (Used during Checkout Phase)
   * * * ARCHITECTURE NOTE:
   * This method utilizes MongoDB's atomic `$inc` combined with a `$gte` query firewall.
   * This prevents Race Conditions if 10 users try to buy the last 1 item at the exact same millisecond.
   */
  public static async reserveStock(
    productId: string,
    quantityToDeduct: number,
  ): Promise<void> {
    const updatedProduct = await Product.findOneAndUpdate(
      {
        _id: { $eq: String(productId) },
        currentStock: { $gte: Number(quantityToDeduct) },
        isActive: true,
      },
      {
        $inc: { currentStock: -Number(quantityToDeduct) },
      },
      { new: true },
    );

    if (!updatedProduct) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        "Insufficient stock available or product is no longer active. The transaction was aborted.",
      );
    }

    // Note: We intentionally do NOT sync stock count to Typesense.
    // Stock is highly volatile and syncs would overwhelm the RAM cluster.
  }

  /**
   * @method mapToTypesense
   * @description Translates a polymorphic MongoDB BSON document into the strict,
   * flat schema required by the Typesense RAM engine.
   */
  private static mapToTypesense(
    product: IBaseProduct,
  ): ITypesenseProductPayload {
    // Safely extract description if it exists on the underlying schema, even if omitted from IBaseProduct
    const safeDescription = String(
      (product as unknown as { description?: string }).description || "",
    );

    return {
      id: String(product._id),
      itemType: String(product.itemType),
      sku: String(product.sku),
      name: String(product.name),
      description: safeDescription,
      mainCategory: String(product.mainCategory),
      basePrice: Number(product.basePrice),
      tags: Array.isArray(product.tags) ? product.tags.map(String) : [],
      images: Array.isArray(product.images) ? product.images.map(String) : [],
    };
  }

  /**
   * @method syncToSearchEngine
   * @description Asynchronous Fire-and-Forget synchronization.
   * Wraps Typesense operations to prevent search outages from crashing primary DB transactions.
   * Eventual Consistency Protocol: Pushes failed syncs to a Dead Letter Queue for exponential retry.
   */
  private static async syncToSearchEngine(
    product: IBaseProduct,
  ): Promise<void> {
    const payload = this.mapToTypesense(product);
    try {
      // Upsert: If the document exists, it updates it. If not, it creates it.
      await typesenseClient.collections("products").documents().upsert(payload);
      logger.info(
        this.safeLog(
          `[Typesense Sync] Product ${product.sku} successfully indexed.`,
        ),
      );
    } catch (error: unknown) {
      const errMsg =
        error instanceof Error
          ? error.message
          : "Unknown synchronization error";

      logger.error(
        this.safeLog(
          `[Typesense Sync] CRITICAL: Failed to index product ${product.sku}. Pushing to DLQ. Reason: ${errMsg}`,
        ),
      );

      // RESILIENCE PATTERN: Push to DLQ with exponential backoff (5s, 10s, 20s...)
      await searchSyncQueue.add(
        "sync-product",
        { action: "UPSERT", payload },
        {
          attempts: 10,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: true,
        },
      );
    }
  }

  /**
   * @method removeFromSearchEngine
   * @description Removes a document from the RAM index (used during soft-deletes).
   */
  private static async removeFromSearchEngine(
    productId: string,
  ): Promise<void> {
    try {
      await typesenseClient
        .collections("products")
        .documents(productId)
        .delete();
      logger.info(
        this.safeLog(
          `[Typesense Sync] Product ${productId} completely removed from index.`,
        ),
      );
    } catch (error: unknown) {
      const tsError = error as { httpStatus?: number; message?: string };
      // HTTP 404 means it's already gone from Typesense. We can safely ignore this.
      if (tsError.httpStatus !== 404) {
        const errMsg = tsError.message || "Unknown deletion error";
        logger.error(
          this.safeLog(
            `[Typesense Sync] Failed to remove product ${productId} from index. Pushing to DLQ. Reason: ${errMsg}`,
          ),
        );

        // RESILIENCE PATTERN: Push to DLQ with exponential backoff
        await searchSyncQueue.add(
          "sync-product",
          { action: "DELETE", productId },
          {
            attempts: 10,
            backoff: { type: "exponential", delay: 5000 },
            removeOnComplete: true,
          },
        );
      }
    }
  }
}

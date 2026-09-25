// ──────────────────────────────────────────────
// Invoice Worker — PDF generation and upload
// ──────────────────────────────────────────────
// The invoice worker: loads an order, generates a PDF buffer, uploads
// it to Cloudinary, and sets `invoiceUrl` on the order. PDF generation
// is mocked (PDFKit is slow and irrelevant here); Cloudinary's
// upload_stream is wired to a fake Writable that immediately resolves.

import { Writable } from "stream";
import { Types } from "mongoose";
import { invoiceQueue } from "@shared/queues/invoice.queue";
import { invoiceWorker } from "@shared/queues/invoice.worker";
import * as invoiceGenerator from "@modules/orders/invoice.generator";
import cloudinary from "@config/cloudinary";
import { Order } from "@modules/orders/order.model";
import { createDeliveredOrder } from "@tests/helpers/order.helper";
import { createUserWithToken } from "@tests/helpers/auth.helper";

// Avoid running PDFKit in tests
jest
  .spyOn(invoiceGenerator, "generateInvoiceBuffer")
  .mockResolvedValue(Buffer.from("FAKE-PDF"));

const mockedUploadStream = cloudinary.uploader
  .upload_stream as unknown as jest.Mock;

function makeFakeUploadStream(
  callback: (err: unknown, result: { secure_url: string } | null) => void,
  url: string,
): Writable {
  return new Writable({
    write(_chunk, _enc, done) {
      done();
    },
    final(done) {
      callback(null, { secure_url: url });
      done();
    },
  });
}

async function waitFor(
  fn: () => boolean | Promise<boolean>,
  timeoutMs = 8000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`waitFor timed out after ${timeoutMs}ms`);
}

describe("Invoice Worker — PDF generation pipeline", () => {
  beforeEach(async () => {
    mockedUploadStream.mockReset();
    mockedUploadStream.mockImplementation((_opts, callback) =>
      makeFakeUploadStream(callback, "https://test.cloudinary.com/invoice.pdf"),
    );
    await invoiceQueue.obliterate({ force: true }).catch(() => undefined);
  });

  afterAll(async () => {
    // Close the internal BullMQ Worker via cast (property is private)
    await (
      invoiceWorker as unknown as { worker: { close: () => Promise<void> } }
    ).worker.close();
    await invoiceQueue.close();
  });

  it("generates, uploads, and sets invoiceUrl on the order", async () => {
    const { accessToken } = await createUserWithToken();
    const { order } = await createDeliveredOrder({
      accessToken,
      paymentMethod: "COD",
    });

    await invoiceQueue.add(
      "generate-invoice",
      { orderId: String(order._id) },
      { removeOnComplete: true },
    );

    await waitFor(async () => {
      const fresh = await Order.findById(order._id);
      return Boolean(fresh?.invoiceUrl);
    });

    const fresh = await Order.findById(order._id);
    expect(fresh?.invoiceUrl).toBe("https://test.cloudinary.com/invoice.pdf");
    expect(mockedUploadStream).toHaveBeenCalledTimes(1);
  });

  it("skips regeneration when invoiceUrl already exists", async () => {
    const { accessToken } = await createUserWithToken();
    const { order } = await createDeliveredOrder({
      accessToken,
      paymentMethod: "COD",
    });

    await Order.updateOne(
      { _id: order._id },
      { $set: { invoiceUrl: "https://existing.example.com/old.pdf" } },
    );

    await invoiceQueue.add(
      "generate-invoice",
      { orderId: String(order._id) },
      { removeOnComplete: true },
    );

    await new Promise((r) => setTimeout(r, 1200));

    expect(mockedUploadStream).not.toHaveBeenCalled();
    const fresh = await Order.findById(order._id);
    expect(fresh?.invoiceUrl).toBe("https://existing.example.com/old.pdf");
  });

  it("passes the correct Cloudinary options derived from the order", async () => {
    const { accessToken } = await createUserWithToken();
    const { order } = await createDeliveredOrder({
      accessToken,
      paymentMethod: "COD",
    });

    await invoiceQueue.add(
      "generate-invoice",
      { orderId: String(order._id) },
      { removeOnComplete: true },
    );

    await waitFor(() => mockedUploadStream.mock.calls.length > 0);

    const opts = mockedUploadStream.mock.calls[0][0] as {
      folder: string;
      public_id: string;
      resource_type: string;
      format: string;
    };
    expect(opts.folder).toBe("reshma_invoices");
    expect(opts.public_id).toBe(`tax_invoice_${order.orderNumber}`);
    expect(opts.resource_type).toBe("raw");
    expect(opts.format).toBe("pdf");
  });

  it("does not call Cloudinary when the order does not exist", async () => {
    const fakeId = new Types.ObjectId().toString();

    await invoiceQueue.add(
      "generate-invoice",
      { orderId: fakeId },
      { attempts: 1, removeOnComplete: true },
    );

    await new Promise((r) => setTimeout(r, 1200));
    expect(mockedUploadStream).not.toHaveBeenCalled();
  });
});

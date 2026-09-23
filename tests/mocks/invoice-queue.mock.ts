// ──────────────────────────────────────────────
// Invoice BullMQ queue mock — prevents real Redis churn during tests
// ──────────────────────────────────────────────

export const invoiceQueue = {
  add: jest.fn().mockResolvedValue({ id: "mock-job-id" }),
  close: jest.fn().mockResolvedValue(undefined),
};

export class InvoiceQueueManager {
  static enqueueInvoiceGeneration = jest
    .fn()
    .mockResolvedValue(undefined);
}
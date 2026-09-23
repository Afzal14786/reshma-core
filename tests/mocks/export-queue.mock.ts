// ──────────────────────────────────────────────
// Data-export BullMQ queue mock
// ──────────────────────────────────────────────

export const dataExportQueue = {
  add: jest.fn().mockResolvedValue({ id: "mock-export-job-id" }),
  close: jest.fn().mockResolvedValue(undefined),
};

export class ExportQueueManager {
  static enqueueDataExport = jest.fn().mockResolvedValue(undefined);
}
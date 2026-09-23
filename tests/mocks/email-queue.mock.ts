// ──────────────────────────────────────────────
// Email BullMQ queue mock — captures dispatches without real Redis churn
// ──────────────────────────────────────────────

export const emailQueue = {
  add: jest.fn().mockResolvedValue({ id: "mock-email-job-id" }),
  close: jest.fn().mockResolvedValue(undefined),
};

export const dispatchEmailJob = jest.fn().mockResolvedValue(undefined);
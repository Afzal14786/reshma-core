// ──────────────────────────────────────────────
// Export Worker — DPDP / GDPR data portability
// ──────────────────────────────────────────────
// The export worker queries MongoDB for every domain a user touches,
// assembles a JSON payload, and hands it to the notification service.

import { Types } from "mongoose";
import { dataExportQueue } from "@shared/queues/export.queue";
import { dataExportWorker } from "@shared/queues/export.worker";
import { NotificationService } from "@modules/notifications/notification.service";
import { createUserWithToken } from "@tests/helpers/auth.helper";
import { createDeliveredOrder } from "@tests/helpers/order.helper";

jest.mock("@modules/notifications/notification.service", () => ({
  NotificationService: {
    sendDataExportEmail: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockedSendExport =
  NotificationService.sendDataExportEmail as unknown as jest.Mock;

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

describe("Export Worker — DPDP data portability", () => {
  beforeEach(async () => {
    mockedSendExport.mockClear();
    await dataExportQueue.obliterate({ force: true }).catch(() => undefined);
  });

  afterAll(async () => {
    await dataExportWorker.close();
    await dataExportQueue.close();
  });

  it("compiles the user's profile and sends the export email", async () => {
    const { user } = await createUserWithToken();

    await dataExportQueue.add(
      "compile-user-data",
      {
        userId: String(user._id),
        email: user.email,
        firstname: user.firstname,
      },
      { removeOnComplete: true },
    );

    await waitFor(() => mockedSendExport.mock.calls.length > 0);

    expect(mockedSendExport).toHaveBeenCalledTimes(1);
    const [to, firstname, buffer] = mockedSendExport.mock.calls[0] as [
      string,
      string,
      Buffer,
    ];
    expect(to).toBe(user.email);
    expect(firstname).toBe(user.firstname);
    expect(Buffer.isBuffer(buffer)).toBe(true);
  });

  it("strips the password and __v fields from the exported profile", async () => {
    const { user } = await createUserWithToken();

    await dataExportQueue.add(
      "compile-user-data",
      {
        userId: String(user._id),
        email: user.email,
        firstname: user.firstname,
      },
      { removeOnComplete: true },
    );

    await waitFor(() => mockedSendExport.mock.calls.length > 0);

    const buffer = mockedSendExport.mock.calls[0][2] as Buffer;
    const parsed = JSON.parse(buffer.toString("utf-8"));
    expect(parsed.identity).toBeDefined();
    expect(parsed.identity.password).toBeUndefined();
    expect(parsed.identity.__v).toBeUndefined();
  });

  it("includes orders in the financials section", async () => {
    const { user, accessToken } = await createUserWithToken();
    await createDeliveredOrder({ accessToken, paymentMethod: "COD" });

    await dataExportQueue.add(
      "compile-user-data",
      {
        userId: String(user._id),
        email: user.email,
        firstname: user.firstname,
      },
      { removeOnComplete: true },
    );

    await waitFor(() => mockedSendExport.mock.calls.length > 0);

    const buffer = mockedSendExport.mock.calls[0][2] as Buffer;
    const parsed = JSON.parse(buffer.toString("utf-8"));
    expect(parsed.financials).toBeDefined();
    expect(parsed.financials.ordersTotalCount).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(parsed.financials.orders)).toBe(true);
  });

  it("returns silently when the user does not exist", async () => {
    const fakeId = new Types.ObjectId().toString();

    await dataExportQueue.add(
      "compile-user-data",
      { userId: fakeId, email: "ghost@test.com", firstname: "Ghost" },
      { removeOnComplete: true },
    );

    // Give the worker a chance to process — it should return early
    await new Promise((r) => setTimeout(r, 1200));
    expect(mockedSendExport).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────
// Email Worker — job processing behavior
// ──────────────────────────────────────────────
// Dispatches real jobs to the email-queue and lets the real Worker
// process them. mailer.sendEmail and NotificationService.compileEmailTemplate
// are mocked so the tests observe the worker's orchestration logic
// without touching SMTP or MJML compilation.

import { emailQueue } from "@shared/queues/email.queue";
import emailWorker from "@shared/queues/email.worker";
import { mailer } from "@shared/infrastructure/mailer";
import { NotificationService } from "@modules/notifications/notification.service";
import type { EmailJobPayload } from "@modules/notifications/interface/email.interface";

jest.mock("@shared/infrastructure/mailer", () => ({
  mailer: { sendEmail: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock("@modules/notifications/notification.service", () => ({
  NotificationService: {
    compileEmailTemplate: jest.fn(),
  },
}));

const mockedSend = mailer.sendEmail as unknown as jest.Mock;
const mockedCompile =
  NotificationService.compileEmailTemplate as unknown as jest.Mock;

function defaultCompileImpl(payload: EmailJobPayload) {
  return Promise.resolve({
    subject: `Mocked ${payload.type}`,
    html: `<p>Mocked ${payload.type}</p>`,
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

describe("Email Worker", () => {
  beforeEach(async () => {
    mockedSend.mockClear();
    mockedCompile.mockReset();
    mockedCompile.mockImplementation(defaultCompileImpl);
    await emailQueue.obliterate({ force: true }).catch(() => undefined);
  });

  afterAll(async () => {
    await emailWorker.close();
    await emailQueue.close();
  });

  it("processes an OTP_VERIFICATION job and calls mailer.sendEmail", async () => {
    await emailQueue.add(
      "OTP_VERIFICATION",
      {
        type: "OTP_VERIFICATION",
        to: "user@test.com",
        data: {
          firstname: "Test",
          otp: "123456",
          expiryTimeIso: new Date().toISOString(),
        },
      },
      { removeOnComplete: true },
    );

    await waitFor(() => mockedSend.mock.calls.length > 0);

    expect(mockedSend).toHaveBeenCalledTimes(1);
    const opts = mockedSend.mock.calls[0][0] as { to: string; subject: string };
    expect(opts.to).toBe("user@test.com");
    expect(opts.subject).toContain("OTP_VERIFICATION");
  });

  it("compiles the template using the full job payload", async () => {
    await emailQueue.add(
      "WELCOME_EMAIL",
      {
        type: "WELCOME_EMAIL",
        to: "user@test.com",
        data: { firstname: "Test" },
      },
      { removeOnComplete: true },
    );

    await waitFor(() => mockedCompile.mock.calls.length > 0);

    const payload = mockedCompile.mock.calls[0][0] as EmailJobPayload;
    expect(payload.type).toBe("WELCOME_EMAIL");
    expect(payload.to).toBe("user@test.com");
  });

  it("attaches export data as a file when processing DATA_EXPORT", async () => {
    await emailQueue.add(
      "DATA_EXPORT",
      {
        type: "DATA_EXPORT",
        to: "user@test.com",
        data: { firstname: "Test", exportPayloadString: '{"foo":"bar"}' },
      },
      { removeOnComplete: true },
    );

    await waitFor(() => mockedSend.mock.calls.length > 0);

    const opts = mockedSend.mock.calls[0][0] as {
      attachments?: Array<{
        filename: string;
        content: string;
        contentType: string;
      }>;
    };
    expect(opts.attachments).toBeDefined();
    expect(opts.attachments).toHaveLength(1);
    expect(opts.attachments![0].filename).toBe(
      "reshma-bangles-data-export.json",
    );
    expect(opts.attachments![0].content).toBe('{"foo":"bar"}');
    expect(opts.attachments![0].contentType).toBe("application/json");
  });

  it("does NOT attach a file for non-DATA_EXPORT jobs", async () => {
    await emailQueue.add(
      "ORDER_DELIVERED",
      {
        type: "ORDER_DELIVERED",
        to: "user@test.com",
        data: { firstname: "Test", orderNumber: "ORD-1" },
      },
      { removeOnComplete: true },
    );

    await waitFor(() => mockedSend.mock.calls.length > 0);

    const opts = mockedSend.mock.calls[0][0] as { attachments?: unknown };
    expect(opts.attachments).toBeUndefined();
  });

  it("processes multiple jobs sequentially", async () => {
    for (let i = 0; i < 3; i++) {
      await emailQueue.add(
        "WELCOME_EMAIL",
        {
          type: "WELCOME_EMAIL",
          to: `user${i}@test.com`,
          data: { firstname: `User${i}` },
        },
        { removeOnComplete: true },
      );
    }

    await waitFor(() => mockedSend.mock.calls.length >= 3);

    const recipients = mockedSend.mock.calls.map(
      (c) => (c[0] as { to: string }).to,
    );
    expect(recipients).toContain("user0@test.com");
    expect(recipients).toContain("user1@test.com");
    expect(recipients).toContain("user2@test.com");
  });

  it("emits a 'failed' event when the processor throws", async () => {
    mockedCompile.mockRejectedValueOnce(new Error("compile exploded"));

    const failedErrors: string[] = [];
    const handler = (_job: unknown, err: Error) =>
      failedErrors.push(err.message);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (emailWorker as any).on("failed", handler);

    await emailQueue.add(
      "WELCOME_EMAIL",
      {
        type: "WELCOME_EMAIL",
        to: "user@test.com",
        data: { firstname: "Test" },
      },
      { attempts: 1, removeOnComplete: true },
    );

    await waitFor(() => failedErrors.length > 0).catch(() => undefined);

    expect(failedErrors.some((m) => m.includes("compile exploded"))).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (emailWorker as any).off("failed", handler);
  });
});

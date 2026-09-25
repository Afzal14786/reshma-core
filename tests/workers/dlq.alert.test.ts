// ──────────────────────────────────────────────
// DLQ Alert — Dead-letter alerting behavior
// ──────────────────────────────────────────────
// sendDLQAlert fires an email only when a BullMQ job has exhausted
// all retry attempts. It runs inside setImmediate so it never blocks
// the worker. It must never throw, even if the mailer fails.

import { Job } from "bullmq";
import { sendDLQAlert } from "@shared/queues/dlq.alert";
import { mailer } from "@shared/infrastructure/mailer";

jest.mock("@shared/infrastructure/mailer", () => ({
  mailer: { sendEmail: jest.fn().mockResolvedValue(undefined) },
}));

const mockedSend = mailer.sendEmail as unknown as jest.Mock;

interface FakeJobOpts {
  id?: string;
  name?: string;
  queueName?: string;
  attemptsMade?: number;
  attempts?: number;
  data?: Record<string, unknown>;
}

function fakeJob(opts: FakeJobOpts = {}): Job {
  return {
    id: opts.id ?? "job-1",
    name: opts.name ?? "OTP_VERIFICATION",
    queueName: opts.queueName ?? "email-queue",
    attemptsMade: opts.attemptsMade ?? 3,
    opts: { attempts: opts.attempts ?? 3 },
    data: opts.data ?? { to: "user@test.com", type: "OTP_VERIFICATION" },
  } as unknown as Job;
}

async function flush(ms = 100): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

describe("DLQ Alert", () => {
  beforeEach(() => {
    mockedSend.mockClear();
  });

  it("sends an alert email when attempts are exhausted", async () => {
    await sendDLQAlert(
      fakeJob({ attemptsMade: 3, attempts: 3 }),
      new Error("boom"),
    );
    await flush();
    expect(mockedSend).toHaveBeenCalledTimes(1);
  });

  it("does NOT send an alert when retries remain", async () => {
    await sendDLQAlert(
      fakeJob({ attemptsMade: 2, attempts: 3 }),
      new Error("boom"),
    );
    await flush();
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it("includes job context in the alert body", async () => {
    await sendDLQAlert(
      fakeJob({
        id: "job-xyz",
        name: "ORDER_CONFIRMATION",
        queueName: "email-queue",
        attemptsMade: 3,
        attempts: 3,
      }),
      new Error("SMTP timeout"),
    );
    await flush();

    const opts = mockedSend.mock.calls[0][0] as {
      subject: string;
      html: string;
    };
    expect(opts.subject).toContain("ORDER_CONFIRMATION");
    expect(opts.html).toContain("job-xyz");
    expect(opts.html).toContain("SMTP timeout");
    expect(opts.html).toContain("email-queue");
  });

  it("treats jobs with no explicit attempts as single-attempt", async () => {
    const job = fakeJob({ attemptsMade: 1 });
    (job.opts as { attempts?: number }).attempts = undefined;
    await sendDLQAlert(job, new Error("boom"));
    await flush();
    expect(mockedSend).toHaveBeenCalledTimes(1);
  });

  it("never throws when the mailer itself fails", async () => {
    mockedSend.mockRejectedValueOnce(new Error("SMTP down"));
    await expect(
      sendDLQAlert(fakeJob(), new Error("original failure")),
    ).resolves.toBeUndefined();
    await flush();
  });
});

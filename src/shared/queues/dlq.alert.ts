import { Job } from "bullmq";
import logger from "@config/logger";
import { mailer } from "../infrastructure/mailer";
import env from "@config/env";

/**
 * ADMIN ALERT EMAILS
 * Comma-separated list from environment variables.
 * Defaults to a safe fallback to prevent missing alerts.
 */
const ADMIN_EMAILS: string[] = env.ADMIN_ALERT_EMAILS
  ? env.ADMIN_ALERT_EMAILS.split(",").map((email: string) => email.trim())
  : ["admin@reshma.com"];

/**
 * Dead Letter Queue (DLQ) Alert Engine
 *
 * This function is called when a BullMQ job fails.
 * It checks if the job has exhausted all retry attempts.
 * If yes, it sends a critical alert email to the Admin team.
 *
 * PRODUCTION-GRADE FEATURES:
 * - Fire-and-forget: Uses setImmediate to prevent blocking the worker.
 * - Error Resilience: Catches and logs any alerting errors (never throws).
 * - Structured Email: Contains all necessary debugging context (Job ID, Queue, Stack Trace, Data).
 * - Deduplication: Only alerts when `attemptsMade >= opts.attempts` (final failure).
 */
export const sendDLQAlert = async (job: Job, error: Error): Promise<void> => {
  // Determine if this is the FINAL failure
  const maxAttempts: number = job.opts.attempts || 1;
  if (job.attemptsMade < maxAttempts) {
    // This is an intermediate failure (will retry). Silently ignore.
    return;
  }

  // Fire-and-forget: Do NOT await the email sending.
  // We schedule it for the next event loop tick to avoid blocking the worker.
  setImmediate(async () => {
    try {
      const subject: string = `[CRITICAL] DLQ Alert: ${job.name} failed permanently`;

      // Build a detailed HTML email for debugging
      const html: string = `
        <h2>BullMQ Dead Letter Queue Alert</h2>
        <p>A job has exhausted all retry attempts and has been moved to the DLQ.</p>
        <hr />
        <p><b>Queue:</b> ${job.queueName}</p>
        <p><b>Job ID:</b> ${job.id}</p>
        <p><b>Job Name:</b> ${job.name}</p>
        <p><b>Attempts Made:</b> ${job.attemptsMade} / ${maxAttempts}</p>
        <p><b>Error Message:</b> ${error.message}</p>
        <p><b>Stack Trace:</b></p>
        <pre style="background: #f4f4f4; padding: 10px;">${error.stack || "No stack trace available."}</pre>
        <p><b>Job Data:</b></p>
        <pre style="background: #f4f4f4; padding: 10px; max-height: 400px; overflow-y: auto;">${JSON.stringify(job.data, null, 2)}</pre>
        <hr />
        <p><b>Timestamp:</b> ${new Date().toISOString()}</p>
        <p><i>This is an automated alert. Please investigate the DLQ immediately.</i></p>
      `;

      // Send to all Admin emails
      const sendPromises: Promise<void>[] = ADMIN_EMAILS.map((email: string) =>
        mailer.sendEmail({
          to: email,
          subject,
          html,
        }),
      );

      await Promise.allSettled(sendPromises);

      logger.info(
        `[DLQ Alert] Alert sent for job ${job.id} (${job.queueName}) to ${ADMIN_EMAILS.join(", ")}`,
      );
    } catch (alertError) {
      // critical: Never throw from here.
      const errMsg: string =
        alertError instanceof Error ? alertError.message : String(alertError);
      logger.error(
        `[DLQ Alert] Failed to send alert for job ${job.id}: ${errMsg}`,
      );
    }
  });
};

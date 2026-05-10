import { Worker, Job } from "bullmq";
import Redis from "ioredis";
import env from "@config/env";
import logger from "@config/logger";
import { mailer } from "../infrastructure/mailer";
import { NotificationService } from "../../modules/notifications/notification.service";
import { EmailJobPayload } from "../../modules/notifications/interface/email.interface";

const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

/**
 * Strict typing for outbound mail parameters to prevent the use of 'any'.
 * Ensures Nodemailer receives exactly what it expects.
 */
interface IMailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType: string;
  }>;
}

/**
 * The Generic Email Worker
 * This worker doesn't know what HTML is. It just asks the NotificationService
 * to compile the template based on the job type, and then pushes it to SMTP.
 */
const emailWorker = new Worker(
  "email-queue",
  async (job: Job) => {
    const payload = job.data as EmailJobPayload;

    // Ask the NotificationService to generate the exact Subject and HTML for this type
    const { subject, html } = NotificationService.compileEmailTemplate(payload);

    // 1. Build the base email parameters using our strict interface
    const mailOptions: IMailOptions = {
      to: payload.to,
      subject,
      html,
    };

    // 2. DPDP / GDPR Legal Engine: The Attachment Bridge
    // If the job is a data export, we take the stringified JSON from Redis
    // and instruct Nodemailer to construct it as a physical file attachment.
    if (payload.type === "DATA_EXPORT") {
      mailOptions.attachments = [
        {
          filename: "reshma-bangles-data-export.json",
          content: payload.data.exportPayloadString,
          contentType: "application/json",
        },
      ];
    }

    // 3. Dispatch to SMTP
    // Note: Ensure your mailer.sendEmail() in src/shared/infrastructure/mailer.ts
    // accepts an 'attachments' array in its expected parameter interface!
    await mailer.sendEmail(mailOptions);
  },
  { connection },
);

emailWorker.on("completed", (job: Job) =>
  logger.info(`[Email Worker] ${job.name} sent successfully`),
);
emailWorker.on("failed", (job: Job | undefined, err: Error) =>
  logger.error(`[Email Worker] ${job?.name} failed:`, err),
);

export default emailWorker;

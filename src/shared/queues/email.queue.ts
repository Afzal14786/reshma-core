import { Queue } from "bullmq";
import Redis from "ioredis";
import env from "@config/env";
import logger from "@config/logger";
import { EmailJobPayload } from "@modules/notifications/interface/email.interface";

const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

export const emailQueue = new Queue("email-queue", { connection });

export const dispatchEmailJob = async (
  payload: EmailJobPayload,
): Promise<void> => {
  try {
    await emailQueue.add(payload.type, payload, {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: true,
    });
    logger.info(`[Email Queue] ${payload.type} dispatched for ${payload.to}`);
  } catch (error) {
    logger.error(`[Email Queue] Failed to dispatch ${payload.type}:`, error);
  }
};

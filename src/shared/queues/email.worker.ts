import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import env from '@config/env';
import logger from '@config/logger';
import { mailer } from '../infrastructure/mailer';
import { NotificationService } from '../../modules/notifications/notification.service';
import { EmailJobPayload } from '../../modules/notifications/interface/email.interface';

const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

/**
 * The Generic Email Worker
 * This worker doesn't know what HTML is. It just asks the NotificationService 
 * to compile the template based on the job type, and then pushes it to SMTP.
 */
const emailWorker = new Worker(
    'email-queue',
    async (job: Job) => {
        const payload = job.data as EmailJobPayload;
        
        // Ask the NotificationService to generate the exact Subject and HTML for this type
        const { subject, html } = NotificationService.compileEmailTemplate(payload);

        await mailer.sendEmail({
            to: payload.to,
            subject,
            html,
        });
    },
    { connection }
);

emailWorker.on('completed', (job: Job) => logger.info(`[Email Worker] ${job.name} sent successfully`));
emailWorker.on('failed', (job: Job | undefined, err: Error) => logger.error(`[Email Worker] ${job?.name} failed:`, err));

export default emailWorker;
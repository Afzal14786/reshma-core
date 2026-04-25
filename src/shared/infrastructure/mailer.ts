import nodemailer from "nodemailer";
import env from "@config/env";

export interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Infrastructure Layer: SMTP Mailer
 * * ARCHITECTURE NOTE:
 * We wrap Nodemailer inside this class rather than using it directly in our services.
 * If the startup scales and we need to switch from Gmail SMTP to an enterprise provider
 * like AWS SES or SendGrid, we only have to rewrite this single file, leaving our
 * entire notification queue and business logic untouched.
 */
class Mailer {
  private transporter: nodemailer.Transporter;

  constructor() {
    // We initialize the connection pool once when the server boots.
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      // Security: Port 465 requires a dedicated SSL connection. Port 587 uses STARTTLS.
      secure: env.SMTP_PORT === 465,
      requireTLS: true, // Forces encryption so customer emails/OTPs aren't sent in plaintext
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }

  /**
   * Dispatches an email payload to the SMTP server.
   * * PERFORMANCE NOTE: This method is network-bound. When used in high-traffic routes
   * (like 'Checkout' or 'Register'), it should be offloaded to our BullMQ Redis queues
   * so the user isn't left waiting for the SMTP handshake to finish.
   */
  public async sendEmail(options: MailOptions): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: env.EMAIL_FROM,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
    } catch (error) {
      // We intercept the error here to log it securely. If we let this bubble up
      // unhandled, Express might accidentally leak our SMTP credentials to the client.
      console.error(
        `[Mailer Infrastructure] Handshake failed for recipient ${options.to}:`,
        error,
      );
      throw error;
    }
  }
}

// Singleton Pattern: We export a single initialized instance.
// This prevents the application from opening thousands of redundant SMTP connections.
export const mailer = new Mailer();

import { baseEmailLayout } from "./layout";

export const ticketCreatedTemplate = (
  firstname: string,
  ticketId: string,
  ticketSubject: string,
): string => {
  const content = `
    <h2 style="color: #333333; font-family: sans-serif;">Support Request Received</h2>
    <p style="font-size: 16px; color: #555555; line-height: 1.5;">Hi ${firstname},</p>
    <p style="font-size: 16px; color: #555555; line-height: 1.5;">
      We have successfully received your support request. Our team is currently reviewing the details and will get back to you as soon as possible.
    </p>
    
    <div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #111827; margin: 25px 0; border-radius: 4px;">
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #333333;">
        <strong style="color: #111827;">Ticket ID:</strong> ${ticketId}
      </p>
      <p style="margin: 0; font-size: 14px; color: #333333;">
        <strong style="color: #111827;">Subject:</strong> ${ticketSubject}
      </p>
    </div>

    <p style="font-size: 16px; color: #555555; line-height: 1.5;">
      You can track the status of your request or add more information at any time by logging into your account dashboard.
    </p>
    <p style="font-size: 16px; color: #555555; line-height: 1.5; margin-top: 30px;">
      Best regards,<br>
      <strong>The Reshma Bangles Support Team</strong>
    </p>
  `;

  return baseEmailLayout("Support Request Received", content);
};

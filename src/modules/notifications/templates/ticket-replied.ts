import { baseEmailLayout } from "./layout";

export const ticketRepliedTemplate = (
  firstname: string,
  ticketId: string,
  replyPreview: string,
): string => {
  const content = `
    <h2 style="color: #333333; font-family: sans-serif;">Update on your Support Ticket</h2>
    <p style="font-size: 16px; color: #555555; line-height: 1.5;">Hi ${firstname},</p>
    <p style="font-size: 16px; color: #555555; line-height: 1.5;">
      A support agent has replied to your ticket (<strong>${ticketId}</strong>).
    </p>
    
    <div style="background-color: #f8f9fa; padding: 20px; border-left: 4px solid #3b82f6; margin: 25px 0; border-radius: 4px; font-style: italic; color: #4b5563;">
      "${replyPreview}"
    </div>

    <p style="font-size: 16px; color: #555555; line-height: 1.5;">
      Please log in to your account dashboard to read the full response and reply to the agent if further assistance is needed.
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{CLIENT_URL}}/account/support/${ticketId}" style="background-color: #111827; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; display: inline-block;">View Ticket</a>
    </div>

    <p style="font-size: 16px; color: #555555; line-height: 1.5; margin-top: 30px;">
      Best regards,<br>
      <strong>The Reshma Bangles Support Team</strong>
    </p>
  `;

  return baseEmailLayout("Update on your Support Ticket", content);
};

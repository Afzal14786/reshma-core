import { baseEmailLayout } from "./layout";
import env from "@config/env";

export const ticketRepliedTemplate = async (
  firstname: string,
  ticketId: string,
  replyPreview: string,
): Promise<string> => {
  const content = `
      <mj-text align="left" css-class="heading-text dark-heading" color="#111827" padding-bottom="16px" font-weight="bold">
        💬 Update on your Ticket
      </mj-text>
      
      <mj-text align="left" css-class="body-text dark-text" color="#4B5563" padding-bottom="32px">
        Hi ${firstname},<br><br>
        A support agent has replied to your open ticket (<strong>${ticketId}</strong>).
      </mj-text>

      <mj-text padding="0" padding-bottom="32px">
        <div style="background-color: #F8F9FA; border-left: 4px solid #111827; border-radius: 4px; padding: 20px;">
          <p style="margin: 0 0 10px 0; font-size: 12px; color: #6B7280; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">
            Agent Reply Preview
          </p>
          <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #111827; font-style: italic;" class="dark-text">
            "${replyPreview}"
          </p>
        </div>
      </mj-text>

      <mj-text align="left" css-class="body-text dark-text" color="#4B5563" padding-bottom="32px">
        Please log into your dashboard to read the full response, view attachments, and reply to the agent if further assistance is needed.
      </mj-text>

      <mj-button href="${env.CLIENT_URL}/support/${ticketId}" background-color="#D97706" color="#FFFFFF" font-size="16px" font-weight="bold" border-radius="8px" width="100%" inner-padding="14px 28px" padding-bottom="32px">
        Reply to Ticket
      </mj-button>
  `;

  return await baseEmailLayout(
    `Update on Support Ticket: ${ticketId}`,
    content,
  );
};

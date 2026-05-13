import { baseEmailLayout } from "./layout";
import env from "@config/env";

export const ticketCreatedTemplate = async (
  firstname: string,
  ticketId: string,
  ticketSubject: string,
): Promise<string> => {
  const content = `
      <mj-text align="left" css-class="heading-text dark-heading" color="#111827" padding-bottom="16px" font-weight="bold">
        🎫 Support Request Received
      </mj-text>
      
      <mj-text align="left" css-class="body-text dark-text" color="#4B5563" padding-bottom="32px">
        Hi ${firstname},<br><br>
        We have successfully received your support request. Our customer success team is reviewing the details and will get back to you shortly.
      </mj-text>

      <mj-text padding="0" padding-bottom="32px">
        <div style="background-color: #F8F9FA; border-left: 4px solid #D97706; border-radius: 4px; padding: 16px;">
          <p style="margin: 0 0 4px 0; font-size: 13px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">Ticket ID</p>
          <p style="margin: 0 0 16px 0; font-size: 15px; font-weight: 600; color: #111827;" class="dark-heading">${ticketId}</p>
          
          <p style="margin: 0 0 4px 0; font-size: 13px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">Subject</p>
          <p style="margin: 0; font-size: 15px; font-weight: 600; color: #111827;" class="dark-heading">${ticketSubject}</p>
        </div>
      </mj-text>

      <mj-text align="left" css-class="small-text dark-muted" color="#D97706" padding-bottom="32px" font-weight="bold">
        ⏱️ We typically respond within 24 business hours.
      </mj-text>

      <mj-button href="${env.CLIENT_URL}/support/${ticketId}" background-color="#D97706" color="#FFFFFF" font-size="16px" font-weight="bold" border-radius="8px" width="100%" inner-padding="14px 28px" padding-bottom="32px">
        View Ticket Status
      </mj-button>
  `;

  return await baseEmailLayout(`Support Ticket Created - ${ticketId}`, content);
};

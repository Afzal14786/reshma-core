import { baseEmailLayout } from "./layout";
import env from "@config/env";

export const returnRejectedTemplate = async (
  firstname: string,
  orderNumber: string,
  reason: string,
): Promise<string> => {
  const content = `
      <mj-text align="left" css-class="heading-text dark-heading" color="#EF4444" padding-bottom="16px" font-weight="bold">
        🚫 Return Request Declined
      </mj-text>
      
      <mj-text align="left" css-class="body-text dark-text" color="#4B5563" padding-bottom="32px">
        Hi ${firstname},<br><br>
        We have carefully reviewed your return request for order <strong>#${orderNumber}</strong>. Unfortunately, we are unable to approve this return based on our store policies.
      </mj-text>

      <mj-text padding="0" padding-bottom="32px">
        <div style="background-color: #FEF2F2; border-left: 4px solid #EF4444; border-radius: 4px; padding: 16px;">
          <p style="margin: 0 0 8px 0; font-size: 13px; color: #B91C1C; text-transform: uppercase; letter-spacing: 0.5px; font-weight: bold;">
            Reason for Decline
          </p>
          <p style="margin: 0; font-size: 15px; font-weight: 500; color: #7F1D1D; line-height: 1.5;">
            ${reason}
          </p>
        </div>
      </mj-text>

      <mj-text align="left" css-class="small-text dark-muted" color="#6B7280" line-height="1.5" padding-bottom="32px">
        We understand this may be disappointing. If you believe there has been a misunderstanding or if you have additional evidence, please <a href="${env.CLIENT_URL}/support" class="footer-link">contact our support team</a>.
      </mj-text>

      <mj-button href="${env.CLIENT_URL}/shop" background-color="transparent" color="#111827" border="2px solid #111827" font-size="16px" font-weight="bold" border-radius="8px" width="100%" inner-padding="14px 28px" padding-bottom="32px" css-class="dark-text dark-border">
        Continue Shopping
      </mj-button>
  `;

  return await baseEmailLayout(
    `Update on Return Request #${orderNumber}`,
    content,
  );
};

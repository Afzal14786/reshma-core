import { baseEmailLayout } from "./layout";
import env from "@config/env";

export const returnRequestedTemplate = async (
  firstname: string,
  orderNumber: string,
): Promise<string> => {
  const content = `
      <mj-text align="left" css-class="heading-text dark-heading" color="#111827" padding-bottom="16px" font-weight="bold">
        🔄 Return Request Initiated
      </mj-text>
      
      <mj-text align="left" css-class="body-text dark-text" color="#4B5563" padding-bottom="32px">
        Hi ${firstname},<br/><br/>
        We have successfully received your return request for Order <strong>#${orderNumber}</strong>. Our quality assurance team is currently reviewing your request and photographic proof.
      </mj-text>

      <mj-text padding="0" padding-bottom="32px">
        <div style="background-color: #F8F9FA; border-left: 4px solid #D97706; border-radius: 4px; padding: 20px;">
          <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: bold; color: #111827;" class="dark-heading">📦 What happens next?</p>
          
          <p style="margin: 0 0 10px 0; font-size: 14px; line-height: 1.5; color: #4B5563;" class="dark-text">
            <strong>1. Review Process:</strong> We typically review requests within 24-48 business hours.
          </p>
          <p style="margin: 0 0 10px 0; font-size: 14px; line-height: 1.5; color: #4B5563;" class="dark-text">
            <strong>2. Approval & Pickup:</strong> Once approved, you will receive an email with your courier pickup schedule.
          </p>
          <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #4B5563;" class="dark-text">
            <strong>3. Refund:</strong> After the item reaches our warehouse and passes physical inspection, your refund will be processed immediately.
          </p>
        </div>
      </mj-text>

      <mj-text align="left" css-class="small-text dark-muted" color="#D97706" padding-bottom="32px" font-weight="bold">
        ⚠️ Important: Please ensure the item is unused, unwashed, and packed in its original packaging with all tags intact.
      </mj-text>

      <mj-button href="${env.CLIENT_URL}/returns" background-color="#D97706" color="#FFFFFF" font-size="16px" font-weight="bold" border-radius="8px" width="100%" inner-padding="14px 28px" padding-bottom="32px">
        Track Return Status
      </mj-button>
  `;
  return await baseEmailLayout(`Return Requested - #${orderNumber}`, content);
};

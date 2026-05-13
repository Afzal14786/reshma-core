import { baseEmailLayout } from "./layout";
import env from "@config/env";

export const returnApprovedTemplate = async (
  firstname: string,
  orderNumber: string,
): Promise<string> => {
  const content = `
      <mj-text align="left" css-class="heading-text dark-heading" color="#059669" padding-bottom="16px" font-weight="bold">
        ✅ Return Approved!
      </mj-text>
      
      <mj-text align="left" css-class="body-text dark-text" color="#4B5563" padding-bottom="32px">
        Hi ${firstname},<br><br>
        Good news! Your return request for order <strong>#${orderNumber}</strong> has been successfully approved by our team.
      </mj-text>

      <mj-text padding="0" padding-bottom="32px">
        <div style="background-color: #F8F9FA; border-left: 4px solid #059669; border-radius: 4px; padding: 20px;">
          <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: bold; color: #111827;" class="dark-heading">Action Required: Next Steps</p>
          
          <p style="margin: 0 0 10px 0; font-size: 14px; line-height: 1.5; color: #4B5563;" class="dark-text">
            <strong>1. Pack Securely:</strong> Place the unused item back in its original packaging with all tags attached.
          </p>
          <p style="margin: 0 0 10px 0; font-size: 14px; line-height: 1.5; color: #4B5563;" class="dark-text">
            <strong>2. Dispatch:</strong> Hand the package over to our courier partner during the scheduled pickup.
          </p>
          <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #4B5563;" class="dark-text">
            <strong>3. Quality Check:</strong> Once the item reaches our warehouse, it will undergo a quick physical inspection before the refund is released.
          </p>
        </div>
      </mj-text>

      <mj-button href="${env.CLIENT_URL}/returns" background-color="#D97706" color="#FFFFFF" font-size="16px" font-weight="bold" border-radius="8px" width="100%" inner-padding="14px 28px" padding-bottom="32px">
        View Shipping Instructions
      </mj-button>
  `;

  return await baseEmailLayout(`Return Approved - #${orderNumber}`, content);
};

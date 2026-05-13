import { baseEmailLayout } from "./layout";
import env from "@config/env";

export const orderCancelledTemplate = async (
  firstname: string,
  orderNumber: string,
  reason: string,
): Promise<string> => {
  const content = `
      <mj-text align="left" css-class="heading-text dark-heading" color="#EF4444" padding-bottom="16px" font-weight="bold">
        🚫 Order Cancelled
      </mj-text>
      
      <mj-text align="left" css-class="body-text dark-text" color="#4B5563" padding-bottom="32px">
        Hi ${firstname},<br><br>
        We are writing to officially confirm that your order <strong>#${orderNumber}</strong> has been cancelled.
      </mj-text>

      <mj-text padding="0" padding-bottom="32px">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F8F9FA; border-left: 4px solid #EF4444; border-radius: 4px;">
          <tr>
            <td style="padding: 16px; border-bottom: 1px solid #E5E7EB;">
              <p style="margin: 0 0 4px 0; font-size: 13px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">Order No.</p>
              <p style="margin: 0; font-size: 15px; font-weight: 600; color: #111827;" class="dark-heading">#${orderNumber}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px;">
              <p style="margin: 0 0 4px 0; font-size: 13px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">Reason</p>
              <p style="margin: 0; font-size: 15px; font-weight: 600; color: #EF4444;">${reason}</p>
            </td>
          </tr>
        </table>
      </mj-text>

      <mj-text padding="0" padding-bottom="32px">
        <div style="background-color: #FEF2F2; border-left: 4px solid #EF4444; border-radius: 4px; padding: 16px;">
          <p style="margin: 0 0 8px 0; font-size: 15px; font-weight: bold; color: #B91C1C;">
            Refund Information
          </p>
          <p style="margin: 0; font-size: 14px; color: #7F1D1D; line-height: 1.5;">
            If a payment was deducted via Razorpay for this order, your refund has already been initiated by our system. Please allow <strong>5-7 business days</strong> for the amount to reflect in your original payment method. If this was a Cash on Delivery (COD) order, no action is required.
          </p>
        </div>
      </mj-text>

      <mj-button href="${env.CLIENT_URL}/shop" background-color="transparent" color="#111827" border="2px solid #111827" font-size="16px" font-weight="bold" border-radius="8px" width="100%" inner-padding="14px 28px" padding-bottom="32px" css-class="dark-text dark-border">
        Continue Shopping
      </mj-button>
  `;

  return await baseEmailLayout(`Order Cancelled - #${orderNumber}`, content);
};

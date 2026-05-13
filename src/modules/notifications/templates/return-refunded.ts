import { baseEmailLayout } from "./layout";
import env from "@config/env";

export const returnRefundedTemplate = async (
  firstname: string,
  orderNumber: string,
  refundAmount: number,
  refundMethod: string,
  refundId: string,
): Promise<string> => {
  const content = `
      <mj-text align="left" css-class="heading-text dark-heading" color="#059669" padding-bottom="16px" font-weight="bold">
        💸 Refund Processed!
      </mj-text>
      
      <mj-text align="left" css-class="body-text dark-text" color="#4B5563" padding-bottom="32px">
        Hi ${firstname},<br><br>
        Your returned items for order <strong>#${orderNumber}</strong> have passed our quality inspection! We have successfully processed your refund.
      </mj-text>

      <mj-text padding="0" padding-bottom="32px">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F8F9FA; border-left: 4px solid #059669; border-radius: 4px;">
          <tr>
            <td colspan="2" style="padding: 20px 20px 10px 20px; text-align: center; border-bottom: 1px solid #E5E7EB;">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #047857; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">Total Refund Amount</p>
              <p style="margin: 0; font-size: 32px; font-weight: bold; color: #059669;">₹${refundAmount.toFixed(2)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 20px; border-bottom: 1px solid #E5E7EB;">
              <p style="margin: 0 0 4px 0; font-size: 12px; color: #6B7280; text-transform: uppercase;">Refunded To</p>
              <p style="margin: 0; font-size: 14px; font-weight: 600; color: #111827;" class="dark-heading">${refundMethod}</p>
            </td>
            <td style="padding: 16px 20px; border-bottom: 1px solid #E5E7EB; text-align: right;">
              <p style="margin: 0 0 4px 0; font-size: 12px; color: #6B7280; text-transform: uppercase;">Reference ID</p>
              <p style="margin: 0; font-size: 14px; font-weight: 600; color: #111827;" class="dark-heading">${refundId}</p>
            </td>
          </tr>
        </table>
      </mj-text>

      <mj-text align="left" css-class="small-text dark-muted" color="#9CA3AF" line-height="1.5" padding-bottom="32px">
        <em>Note: The refunded amount reflects the exact value paid for the item after proportionately deducting any cart-level coupons, discounts, or non-refundable shipping charges applied during checkout.</em>
      </mj-text>

      <mj-divider border-width="1px" border-color="#F3F4F6" padding-bottom="32px" css-class="dark-border" />

      <mj-text align="left" css-class="body-text dark-text" color="#4B5563" line-height="1.5" padding-bottom="32px">
        Please allow <strong>5-7 business days</strong> for the funds to reflect in your bank account or credit card statement. You can use the Reference ID provided above if you need to track this transaction with your bank.
      </mj-text>

      <mj-button href="${env.CLIENT_URL}/orders" background-color="#D97706" color="#FFFFFF" font-size="16px" font-weight="bold" border-radius="8px" width="100%" inner-padding="14px 28px" padding-bottom="32px">
        View Order Summary
      </mj-button>
  `;

  return await baseEmailLayout(`Refund Processed - #${orderNumber}`, content);
};

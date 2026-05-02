import { baseEmailLayout } from "./layout";
import env from "@config/env";

export const orderCancelledTemplate = (
  firstname: string,
  orderNumber: string,
  reason: string,
): string => {
  const content = `
      <h2 style="margin-top: 0; color: #ef4444; font-size: 24px;">Order Cancelled</h2>
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
          Hi ${firstname},<br><br>
          We are writing to inform you that your order <strong>${orderNumber}</strong> has been cancelled.
      </p>
      
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
          <strong>Reason for cancellation:</strong> ${reason}
      </p>

      <p style="color: #4b5563; font-size: 14px; background-color: #fef2f2; padding: 15px; border-radius: 4px; border-left: 4px solid #ef4444;">
          <strong>Refund Information:</strong> If a payment was deducted for this order, the refund process has already been initiated automatically. It will reflect in your original payment method within 5-7 business days.
      </p>

      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 30px 0;">
          <tr>
              <td align="center">
                  <a href="${env.CLIENT_URL}/shop" style="background-color: #d97706; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 14px;">
                      Continue Shopping
                  </a>
              </td>
          </tr>
      </table>
  `;

  return baseEmailLayout(`Order Cancelled - ${orderNumber}`, content);
};

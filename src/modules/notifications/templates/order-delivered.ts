import { baseEmailLayout } from "./layout";
import env from "@config/env";

export const orderDeliveredTemplate = (
  firstname: string,
  orderNumber: string,
): string => {
  const content = `
      <h2 style="margin-top: 0; color: #059669; font-size: 24px;">Your order has arrived!</h2>
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
          Hi ${firstname},<br><br>
          Great news! Your order <strong>${orderNumber}</strong> has been successfully delivered to your address.
      </p>
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
          We hope you love your new items. If you have any issues or wish to return an item, you can initiate a return from your dashboard within 7 days.
      </p>
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 30px 0;">
          <tr>
              <td align="center">
                  <a href="${env.CLIENT_URL}/orders" style="background-color: #d97706; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 14px;">
                      View Order Details
                  </a>
              </td>
          </tr>
      </table>
  `;
  return baseEmailLayout(`Order Delivered - ${orderNumber}`, content);
};

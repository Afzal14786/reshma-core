import { baseEmailLayout } from "./layout";
import env from "@config/env";

export const orderPlacedTemplate = (
  firstname: string,
  orderNumber: string,
  totalAmount: number,
): string => {
  const content = `
      <h2 style="margin-top: 0; color: #111827; font-size: 24px;">Thank you for your order, ${firstname}!</h2>
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
          We have successfully received your order <strong>${orderNumber}</strong>. We are currently processing it and will notify you the moment it ships.
      </p>
      
      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #d97706;">
          <p style="margin: 0; color: #374151; font-size: 16px;">
              <strong>Order Total:</strong> ₹${totalAmount.toFixed(2)}
          </p>
      </div>

      <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
          You can track your order status and download your official tax invoice anytime from your dashboard.
      </p>
      
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 30px 0;">
          <tr>
              <td align="center">
                  <a href="${env.CLIENT_URL}/orders" style="background-color: #111827; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 14px;">
                      View Order Details
                  </a>
              </td>
          </tr>
      </table>
  `;

  return baseEmailLayout(`Order Confirmation - ${orderNumber}`, content);
};

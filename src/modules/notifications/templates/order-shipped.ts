import { baseEmailLayout } from "./layout";
import env from "@config/env";

export const orderShippedTemplate = async (
  firstname: string,
  orderNumber: string,
  trackingNumber: string,
  courierName: string,
): Promise<string> => {
  const content = `
      <mj-text align="left" css-class="heading-text dark-heading" color="#111827" padding-bottom="16px" font-weight="bold">
        🚚 Your Order is on the way!
      </mj-text>
      
      <mj-text align="left" css-class="body-text dark-text" color="#4B5563" padding-bottom="32px">
        Hi ${firstname},<br><br>
        Great news! Your order <strong>#${orderNumber}</strong> has been packed and handed over to our logistics partner. It is now officially in transit to your address.
      </mj-text>

      <mj-text padding="0" padding-bottom="32px">
        <div style="background-color: #F8F9FA; border-radius: 8px; padding: 20px; text-align: center;">
          <p style="margin: 0; font-size: 14px; color: #D97706; font-weight: bold;">
            ✅ Placed &nbsp;&nbsp;➔&nbsp;&nbsp; ✅ Processing &nbsp;&nbsp;➔&nbsp;&nbsp; 🚚 Shipped &nbsp;&nbsp;➔&nbsp;&nbsp; 🏠 Delivered
          </p>
        </div>
      </mj-text>

      <mj-text padding="0" padding-bottom="32px">
        <div style="background-color: #F8F9FA; border-left: 4px solid #D97706; border-radius: 4px; padding: 16px;">
          <p style="margin: 0 0 4px 0; font-size: 13px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">Logistics Partner</p>
          <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: bold; color: #111827;" class="dark-heading">${courierName}</p>
          
          <p style="margin: 0 0 4px 0; font-size: 13px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">Tracking Number</p>
          <p style="margin: 0; font-size: 18px; font-weight: bold; color: #D97706; letter-spacing: 1px;">${trackingNumber}</p>
        </div>
      </mj-text>

      <mj-button href="${env.CLIENT_URL}/orders" background-color="#D97706" color="#FFFFFF" font-size="16px" font-weight="bold" border-radius="8px" width="100%" inner-padding="14px 28px" padding-bottom="32px" css-class="btn-gradient">
        Track Package
      </mj-button>

      <mj-text align="left" css-class="small-text dark-muted" color="#9CA3AF" line-height="1.5">
        Please note: It may take up to 24 hours for the tracking link to activate on the courier's website.
      </mj-text>
  `;

  return await baseEmailLayout(
    `Your Order #${orderNumber} has shipped!`,
    content,
  );
};

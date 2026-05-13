import { baseEmailLayout } from "./layout";
import env from "@config/env";
import {
  IOrderItem,
  IOrderShippingAddress,
} from "@modules/orders/interfaces/order.interface";

export const orderPlacedTemplate = async (
  firstname: string,
  orderNumber: string,
  totalAmount: number,
  items: IOrderItem[],
  shippingAddress: IOrderShippingAddress,
): Promise<string> => {
  // Dynamically generate the product grid HTML
  const itemsHtml = items
    .map(
      (item) => `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px;">
      <tr>
        <td width="80" style="width: 80px; vertical-align: top;">
          <img src="${item.imageSnapshot}" alt="${item.name}" width="80" height="80" style="border-radius: 8px; border: 1px solid #F3F4F6; display: block;" />
        </td>
        <td style="padding-left: 16px; vertical-align: middle;">
          <p style="margin: 0 0 4px 0; font-size: 16px; font-weight: bold; color: #111827;" class="dark-heading">${item.name}</p>
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #4B5563;" class="dark-text">Qty: ${item.quantity}</p>
          <p style="margin: 0; font-size: 16px; font-weight: bold; color: #D97706;">₹${item.priceAtPurchase.toFixed(2)}</p>
        </td>
      </tr>
    </table>
  `,
    )
    .join("");

  const content = `
      <mj-text align="left" css-class="heading-text dark-heading" color="#111827" padding-bottom="16px" font-weight="bold">
        🎉 Order Confirmed!
      </mj-text>
      
      <mj-text align="left" css-class="body-text dark-text" color="#4B5563" padding-bottom="32px">
        Thank you for your order, ${firstname}! We have successfully received it and our warehouse team is currently processing your items. We will notify you the exact moment it ships out.
      </mj-text>

      <mj-text padding="0" padding-bottom="32px">
        <div style="background-color: #F8F9FA; border-radius: 8px; padding: 20px; text-align: center;">
          <p style="margin: 0; font-size: 14px; color: #D97706; font-weight: bold;">
            ✅ Placed &nbsp;&nbsp;➔&nbsp;&nbsp; ⏳ Processing &nbsp;&nbsp;➔&nbsp;&nbsp; 📦 Shipped &nbsp;&nbsp;➔&nbsp;&nbsp; 🏠 Delivered
          </p>
        </div>
      </mj-text>

      <mj-text align="left" css-class="heading-text dark-heading" color="#111827" padding-bottom="20px" font-weight="bold">
        Order Summary
      </mj-text>
      <mj-text padding="0" padding-bottom="16px">
        ${itemsHtml}
      </mj-text>

      <mj-text padding="0" padding-bottom="32px">
        <div style="background-color: #F8F9FA; border-left: 4px solid #D97706; border-radius: 4px; padding: 20px;">
          <p style="margin: 0 0 8px 0; font-size: 13px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px; font-weight: bold;">Shipping To</p>
          <p style="margin: 0; font-size: 14px; color: #111827; line-height: 1.6;" class="dark-heading">
            <strong>${shippingAddress.fullName}</strong><br/>
            ${shippingAddress.streetAddress}<br/>
            ${shippingAddress.city}, ${shippingAddress.state} - ${shippingAddress.postalCode}<br/>
            Ph: ${shippingAddress.phone}
          </p>
        </div>
      </mj-text>

      <mj-text padding="0" padding-bottom="32px">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F8F9FA; border-left: 4px solid #D97706; border-radius: 4px;">
          <tr>
            <td style="padding: 16px;">
              <p style="margin: 0 0 4px 0; font-size: 13px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">Order Number</p>
              <p style="margin: 0; font-size: 16px; font-weight: 600; color: #111827;" class="dark-heading">#${orderNumber}</p>
            </td>
            <td style="padding: 16px; text-align: right;">
              <p style="margin: 0 0 4px 0; font-size: 13px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">Grand Total</p>
              <p style="margin: 0; font-size: 20px; font-weight: bold; color: #D97706;">₹${totalAmount.toFixed(2)}</p>
            </td>
          </tr>
        </table>
      </mj-text>

      <mj-button href="${env.CLIENT_URL}/orders" background-color="#D97706" color="#FFFFFF" font-size="16px" font-weight="bold" border-radius="8px" width="100%" inner-padding="14px 28px" padding-bottom="16px" css-class="btn-gradient">
        Track Your Order
      </mj-button>
      
      <mj-button href="${env.CLIENT_URL}/shop" background-color="transparent" color="#111827" border="2px solid #111827" font-size="16px" font-weight="bold" border-radius="8px" width="100%" inner-padding="12px 28px" padding-bottom="32px" css-class="dark-text dark-border">
        Continue Shopping
      </mj-button>

      <mj-text align="left" css-class="small-text dark-muted" color="#9CA3AF">
        You can track your real-time shipping status and download your official GST tax invoice anytime from your account dashboard.
      </mj-text>
  `;

  return await baseEmailLayout(`Order Confirmation - #${orderNumber}`, content);
};

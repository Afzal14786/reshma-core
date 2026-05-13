import { baseEmailLayout } from "./layout";
import env from "@config/env";

export const orderDeliveredTemplate = async (
  firstname: string,
  orderNumber: string,
): Promise<string> => {
  const content = `
      <mj-text align="left" css-class="heading-text dark-heading" color="#059669" padding-bottom="16px" font-weight="bold">
        📦 It's here!
      </mj-text>
      
      <mj-text align="left" css-class="body-text dark-text" color="#4B5563" padding-bottom="32px">
        Hi ${firstname},<br><br>
        Great news! Your Reshma Bangles order <strong>#${orderNumber}</strong> has been successfully delivered. We hope you love your handcrafted items!
      </mj-text>

      <mj-text padding="0" padding-bottom="32px">
        <div style="background-color: #F8F9FA; border-left: 4px solid #059669; border-radius: 4px; padding: 20px;">
          <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: bold; color: #111827;" class="dark-heading">What's next?</p>
          
          <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: bold; color: #D97706;">⭐ Leave a review!</p>
          <p style="margin: 0 0 16px 0; font-size: 14px; color: #4B5563; line-height: 1.5;" class="dark-text">Help others make great choices by leaving a review on the product page.</p>
          
          <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: bold; color: #111827;" class="dark-heading">🔄 Need to return an item?</p>
          <p style="margin: 0; font-size: 14px; color: #4B5563; line-height: 1.5;" class="dark-text">We want you to be 100% satisfied. You have 7 days from today to initiate a hassle-free return directly from your dashboard.</p>
        </div>
      </mj-text>

      <mj-button href="${env.CLIENT_URL}/orders" background-color="#111827" color="#FFFFFF" font-size="16px" font-weight="bold" border-radius="8px" width="100%" inner-padding="14px 28px" padding-bottom="32px">
        View Order Dashboard
      </mj-button>

      <mj-text align="left" css-class="small-text dark-muted" color="#9CA3AF" padding-top="16px">
        Thank you for choosing Reshma Bangles & Boutique!
      </mj-text>
  `;

  return await baseEmailLayout(
    `Delivered: Your Order #${orderNumber}`,
    content,
  );
};

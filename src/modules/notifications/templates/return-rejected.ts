import { baseEmailLayout } from "./layout";

export const returnRejectedTemplate = (firstname: string, orderNumber: string, reason: string): string => {
  const content = `
      <h2 style="margin-top: 0; color: #ef4444; font-size: 24px;">Return Request Declined</h2>
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
          Hi ${firstname},<br><br>
          We have reviewed your return request for order <strong>${orderNumber}</strong>. Unfortunately, we are unable to approve this return based on our store policies.
      </p>
      <p style="color: #4b5563; font-size: 14px; background-color: #fef2f2; padding: 15px; border-radius: 4px; border-left: 4px solid #ef4444;">
          <strong>Admin Note:</strong> ${reason}
      </p>
  `;
  return baseEmailLayout(`Return Request Update - ${orderNumber}`, content);
};
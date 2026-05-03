import { baseEmailLayout } from "./layout";
import env from "@config/env";

export const returnRequestedTemplate = (firstname: string, orderNumber: string): string => {
  const content = `
      <h2 style="margin-top: 0; color: #111827; font-size: 24px;">Return Request Received</h2>
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
          Hi ${firstname},<br><br>
          We have received your return request for order <strong>${orderNumber}</strong>. 
          Our quality assurance team is reviewing the details and photographic proof (if applicable).
      </p>
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
          This process typically takes 1-2 business days. We will notify you immediately once a decision is made.
      </p>
  `;
  return baseEmailLayout(`Return Request Received - ${orderNumber}`, content);
};
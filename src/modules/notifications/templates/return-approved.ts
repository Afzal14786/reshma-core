import { baseEmailLayout } from "./layout";
import env from "@config/env";

export const returnApprovedTemplate = (
  firstname: string,
  orderNumber: string,
): string => {
  const content = `
      <h2 style="margin-top: 0; color: #059669; font-size: 24px;">Return Approved</h2>
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
          Hi ${firstname},<br><br>
          Good news! Your return request for order <strong>${orderNumber}</strong> has been approved.
      </p>
      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #059669;">
          <h3 style="margin-top: 0; color: #111827;">Next Steps:</h3>
          <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.5;">
              1. Securely pack the items in their original packaging.<br>
              2. Ship the package to our Central Hub (address available in your dashboard).<br>
              3. Once we receive and verify the items, your refund will be processed immediately.
          </p>
      </div>
  `;
  return baseEmailLayout(`Return Approved - ${orderNumber}`, content);
};

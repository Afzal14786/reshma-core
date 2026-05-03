import { baseEmailLayout } from "./layout";

export const returnRefundedTemplate = (
  firstname: string,
  orderNumber: string,
  refundAmount: number,
): string => {
  const content = `
      <h2 style="margin-top: 0; color: #059669; font-size: 24px;">Refund Processed!</h2>
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
          Hi ${firstname},<br><br>
          We have successfully received your returned items for order <strong>${orderNumber}</strong>. 
          A refund has been initiated to your original payment method.
      </p>
      <div style="background-color: #ecfdf5; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #059669; text-align: center;">
          <p style="margin: 0; color: #065f46; font-size: 20px;">
              <strong>Refund Amount:  ${refundAmount.toFixed(2)}</strong>
          </p>
      </div>
      <p style="color: #6b7280; font-size: 14px;">
          Please allow 5-7 business days for the funds to reflect in your account, depending on your bank's processing times.
      </p>
  `;
  return baseEmailLayout(`Refund Processed - ${orderNumber}`, content);
};

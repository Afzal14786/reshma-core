import { baseEmailLayout } from "./layout";

export const passwordUpdateTemplate = (
  firstname: string,
  changedField: string,
  time: string,
): string => {
  const content = `
      <h2 style="margin-top: 0; color: #111827; font-size: 24px;">Security Alert: ${changedField} Updated</h2>
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
          Hi ${firstname},<br><br>
          This is an automated security alert to inform you that your <strong>${changedField}</strong> was successfully changed on <strong>${new Date(time).toLocaleString()}</strong>.
      </p>
      
      <p style="color: #ef4444; font-size: 14px; background-color: #fef2f2; padding: 15px; border-radius: 4px; border-left: 4px solid #ef4444;">
          <strong>Didn't make this change?</strong> If you did not authorize this update, please contact our support team immediately to secure your account.
      </p>
  `;
  return baseEmailLayout(`Security Alert: ${changedField} Changed`, content);
};

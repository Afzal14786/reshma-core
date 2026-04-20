import { baseEmailLayout } from "./layout";
import env from "@config/env";

export const passwordResetTemplate = (firstname: string, resetToken: string): string => {
  const resetUrl = `${env.CLIENT_URL}/auth/reset-password?token=${resetToken}`;
    
  const content = `
      <h2 style="margin-top: 0; color: #111827; font-size: 24px;">Password Reset Request</h2>
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
          Hi ${firstname},<br><br>
          We received a request to reset the password associated with your Reshma Bangles account. 
          If you made this request, please click the button below to set a new secure password.
      </p>
      
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 30px 0;">
          <tr>
              <td align="center">
                  <a href="${resetUrl}" style="background-color: #111827; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 14px;">
                      Reset Password
                  </a>
              </td>
          </tr>
      </table>
      
      <p style="color: #ef4444; font-size: 14px; background-color: #fef2f2; padding: 15px; border-radius: 4px; border-left: 4px solid #ef4444;">
          <strong>Security Notice:</strong> This link will expire in 15 minutes. If you did not request a password reset, you can safely ignore this email. Your account remains secure.
      </p>
  `;

  return baseEmailLayout("Password Reset Instructions", content);
};
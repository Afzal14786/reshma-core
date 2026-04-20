import { baseEmailLayout } from "./layout";
import env from "@config/env";

export const welcomeEmailTemplate = (firstname: string): string => {
  const content = `
      <h2 style="margin-top: 0; color: #111827; font-size: 24px;">Welcome to the family, ${firstname}!</h2>
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
          Your email has been successfully verified, and your account is now fully active. 
          We are absolutely thrilled to welcome you to Reshma Bangles.
      </p>
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
          As a member, you now have access to exclusive collections, faster checkout, and seamless order tracking.
      </p>
      
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 30px 0;">
          <tr>
              <td align="center">
                  <a href="${env.CLIENT_URL}/shop" style="background-color: #d97706; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; text-transform: uppercase; font-size: 14px; letter-spacing: 1px;">
                      Explore Collections
                  </a>
              </td>
          </tr>
      </table>

      <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
          If you have any questions or need assistance, simply reply to this email or visit our <a href="${env.CLIENT_URL}/support" style="color: #d97706;">Support Center</a>.
      </p>
  `;

  return baseEmailLayout("Welcome to Reshma Bangles!", content);
};
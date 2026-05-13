import { baseEmailLayout } from "./layout";
import env from "@config/env";

export const passwordUpdateTemplate = async (
  firstname: string,
  changedField: string,
  time: string,
): Promise<string> => {
  // Format the ISO time to a highly readable, localized format
  const formattedTime = new Date(time).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });

  const content = `
      <mj-text align="left" css-class="heading-text dark-heading" color="#111827" padding-bottom="16px" font-weight="bold">
        ⚠️ Security Alert
      </mj-text>
      
      <mj-text align="left" css-class="body-text dark-text" color="#4B5563" padding-bottom="32px">
        Hi ${firstname},<br><br>
        This is an automated security alert to inform you that critical profile information was recently changed on your Reshma Bangles account.
      </mj-text>

      <mj-text padding="0" padding-bottom="32px">
        <div style="background-color: #F8F9FA; border-left: 4px solid #111827; border-radius: 4px; padding: 16px;">
          <p style="margin: 0 0 4px 0; font-size: 13px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">Field Updated</p>
          <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: bold; color: #111827;">${changedField}</p>
          
          <p style="margin: 0 0 4px 0; font-size: 13px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">Time &amp; Date</p>
          <p style="margin: 0; font-size: 16px; font-weight: bold; color: #111827;">${formattedTime}</p>
        </div>
      </mj-text>

      <mj-text padding="0" padding-bottom="32px">
        <div style="background-color: #FEF2F2; border-left: 4px solid #EF4444; border-radius: 4px; padding: 16px;">
          <p style="margin: 0 0 8px 0; font-size: 15px; font-weight: bold; color: #B91C1C;">
            Didn't make this change?
          </p>
          <p style="margin: 0; font-size: 14px; color: #7F1D1D; line-height: 1.5;">
            If you did not authorize this update, your account may be compromised. Please <a href="${env.CLIENT_URL}/support" style="color: #B91C1C; text-decoration: underline; font-weight: bold;">contact support immediately</a> to secure your account.
          </p>
        </div>
      </mj-text>
  `;

  return await baseEmailLayout(
    `Security Alert: ${changedField} Changed`,
    content,
  );
};

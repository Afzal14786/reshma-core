import { baseEmailLayout } from "./layout";
import env from "@config/env";

/**
 * DPDP / GDPR Data Export Email Template
 * * ARCHITECTURE NOTE:
 * This template strictly handles the MJML body. The actual JSON buffer
 * attachment is handled dynamically by Nodemailer in the worker layer.
 */
export const dataExportTemplate = async (
  firstname: string,
): Promise<string> => {
  const content = `
      <mj-text align="left" css-class="heading-text dark-heading" color="#111827" padding-bottom="16px" font-weight="bold">
        🛡️ Your Data is Ready
      </mj-text>
      
      <mj-text align="left" css-class="body-text dark-text" color="#4B5563" padding-bottom="32px" line-height="1.5">
        Hi ${firstname},<br><br>
        Pursuant to your privacy request and our commitment to the Digital Personal Data Protection Act (DPDP), we have compiled a complete, machine-readable export of the personal data associated with your Reshma Bangles account.
      </mj-text>

      <mj-text padding="0" padding-bottom="32px">
        <div style="background-color: #F8F9FA; border-left: 4px solid #D97706; border-radius: 4px; padding: 20px;">
          <p style="margin: 0 0 12px 0; font-size: 15px; font-weight: bold; color: #111827;" class="dark-heading">
            📎 Secure JSON File Attached
          </p>
          <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #4B5563; line-height: 1.6;" class="dark-text">
            <li>Identity and Demographic Profile</li>
            <li>Complete Order and Financial History</li>
            <li>Product Interactions and Reviews</li>
          </ul>
          <p style="margin: 16px 0 0 0; font-size: 14px; color: #4B5563; line-height: 1.5;" class="dark-text">
            Your requested data is attached directly to this email as an <strong>export.json</strong> file. You can open and view this file using any standard web browser or text editor.
          </p>
        </div>
      </mj-text>

      <mj-text padding="0" padding-bottom="32px">
        <div style="background-color: #FEF2F2; border-left: 4px solid #EF4444; border-radius: 4px; padding: 16px;">
          <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: bold; color: #B91C1C; text-transform: uppercase; letter-spacing: 1px;">
            ⚠️ Critical Privacy Warning
          </p>
          <p style="margin: 0; font-size: 14px; color: #7F1D1D; line-height: 1.5;">
            This file contains highly sensitive personal, address, and financial interaction data. <strong>Do not forward this email or share this file with anyone.</strong> Please ensure you download and store it only on a private, secure device.
          </p>
        </div>
      </mj-text>

      <mj-text align="left" css-class="small-text dark-muted" color="#6B7280" line-height="1.5">
        <strong>Didn't request this?</strong><br>
        If you did not initiate a data portability request from your account dashboard, your account may be compromised. Please <a href="${env.CLIENT_URL}/support" class="footer-link">contact our privacy team immediately</a> to secure your account.
      </mj-text>
  `;

  return await baseEmailLayout(
    "Your Data Export - Reshma Bangles Privacy",
    content,
  );
};

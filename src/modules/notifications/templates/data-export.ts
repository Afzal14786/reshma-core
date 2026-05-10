import { baseEmailLayout } from "./layout";

/**
 * DPDP / GDPR Data Export Email Template
 * * ARCHITECTURE NOTE:
 * This template strictly handles the HTML body. The actual JSON buffer
 * attachment is handled dynamically by Nodemailer in the worker layer.
 */
export const dataExportTemplate = (firstname: string): string => {
  const content = `
    <div style="text-align: center; margin-bottom: 24px;">
      <h2 style="color: #333333; margin-bottom: 8px;">Your Data Export is Ready</h2>
      <p style="color: #666666; font-size: 16px;">Requested under Data Protection Regulations</p>
    </div>

    <p>Hi ${firstname},</p>
    
    <p>Pursuant to your recent request, we have compiled a complete copy of the personal data associated with your Reshma Bangles account.</p>
    
    <div style="background-color: #f8f9fa; border-left: 4px solid #3448C5; padding: 16px; margin: 24px 0;">
      <h3 style="margin-top: 0; color: #333333; font-size: 16px;">What's Included:</h3>
      <ul style="color: #555555; margin-bottom: 0;">
        <li>Identity and Demographic Profile</li>
        <li>Complete Order and Financial History</li>
        <li>Shopping Cart and Wishlist States</li>
        <li>Product Interactions and Reviews</li>
      </ul>
    </div>

    <p><strong>SECURITY WARNING:</strong> The attached <code>data-export.json</code> file contains highly sensitive personal and financial information. Please ensure you download and store this file on a secure, private device. Do not forward this email or share the file with untrusted third parties.</p>

    <p>If you did not request this data export, please contact our security team immediately and change your account password.</p>

    <br/>
    <p>Best regards,<br/>The Reshma Bangles Privacy Team</p>
  `;

  return baseEmailLayout("Data Export - ", content);
};

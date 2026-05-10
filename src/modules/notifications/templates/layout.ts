import env from "@config/env";

/**
 * Master Email Layout
 * * ARCHITECTURE NOTE:
 * Email clients (Gmail, Outlook, Apple Mail) strip out modern CSS and `<style>` tags.
 * We must use inline CSS and table-based layouts to ensure the email renders
 * perfectly across all devices. This layout wraps around all our transactional emails.
 */
export const baseEmailLayout = (title: string, content: string): string => {
  const currentYear = new Date().getFullYear();
  // Using a secure HTTPS Cloudinary link for the logo ensures it renders in Gmail
  const logoUrl =
    "https://res.cloudinary.com/dl9bfojiu/image/upload/email-logo_z1eqed.svg";

  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
  </head>
  <body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f9fafb; color: #111827;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9fafb; padding: 40px 20px;">
          <tr>
              <td align="center">
                  <table width="100%" max-width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); max-width: 600px;">
                      
                      <tr>
                          <td align="center" style="padding: 30px 0; border-bottom: 1px solid #f3f4f6;">
                              <img src="${logoUrl}" alt="Reshma Bangles &amp; Boutique" width="220" style="display: block; max-width: 220px; height: auto;" />
                          </td>
                      </tr>

                      <tr>
                          <td style="padding: 40px 30px; line-height: 1.6;">
                              ${content}
                          </td>
                      </tr>

                      <tr>
                          <td align="center" style="background-color: #f3f4f6; padding: 20px; font-size: 12px; color: #6b7280;">
                              <p style="margin: 0 0 10px 0;">Need help? Contact us at <a href="mailto:${env.EMAIL_FROM}" style="color: #d97706; text-decoration: none;">${env.EMAIL_FROM}</a></p>
                              <p style="margin: 0;">&copy; ${currentYear} Reshma Bangles. All rights reserved.</p>
                              <p style="margin: 5px 0 0 0;">Navi Mumbai, Maharashtra, India</p>
                          </td>
                      </tr>

                  </table>
              </td>
          </tr>
      </table>
  </body>
  </html>
  `;
};

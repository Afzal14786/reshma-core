import { baseEmailLayout } from "./layout";
import env from "@config/env";

/**
 * Generates the MJML template for the Welcome Email.
 * @param firstname - The user's first name.
 */
export const welcomeEmailTemplate = async (
  firstname: string,
): Promise<string> => {
  // Replace these placeholders with your actual Cloudinary URLs
  const heroBannerUrl =
    "https://res.cloudinary.com/dl9bfojiu/image/upload/boutique_banner_wgy5te.jpg";
  const product1Url =
    "https://res.cloudinary.com/dl9bfojiu/image/upload/diamond_bralate_mdtjx7.jpg";
  const product2Url =
    "https://res.cloudinary.com/dl9bfojiu/image/upload/gold_jwellary_nkw4zw.jpg";
  const product3Url =
    "https://res.cloudinary.com/dl9bfojiu/image/upload/bangles_ytinhc.jpg";

  const content = `
      <mj-image src="${heroBannerUrl}" alt="Welcome to Reshma Bangles" border-radius="8px" padding-bottom="32px" fluid-on-mobile="true" padding="0" />

      <mj-text align="left" css-class="heading-text dark-heading" color="#111827" padding-bottom="16px" font-weight="bold">
        Welcome to the family, ${firstname}!
      </mj-text>
      
      <mj-text align="left" css-class="body-text dark-text" color="#4B5563" padding-bottom="32px">
        Your email has been successfully verified, and your account is now fully active. We are absolutely thrilled to welcome you to Reshma Bangles & Boutique.
      </mj-text>

      <mj-text padding="0" padding-bottom="32px">
        <div style="background-color: #F8F9FA; border-left: 4px solid #D97706; border-radius: 4px; padding: 20px;">
          <p style="margin: 0 0 16px 0; font-size: 15px; color: #111827;" class="dark-text">
            🚀 <strong>Free Shipping</strong> on orders over ₹999
          </p>
          <p style="margin: 0 0 16px 0; font-size: 15px; color: #111827;" class="dark-text">
            🔄 <strong>Easy Returns</strong> within 7 days
          </p>
          <p style="margin: 0; font-size: 15px; color: #111827;" class="dark-text">
            💎 <strong>Member-only Prices</strong> &amp; early access
          </p>
        </div>
      </mj-text>

      <mj-button href="${env.CLIENT_URL}/shop" background-color="#D97706" color="#FFFFFF" font-size="16px" font-weight="bold" border-radius="8px" width="100%" inner-padding="14px 28px" padding-bottom="32px">
        Shop Best Sellers
      </mj-button>

      <mj-divider border-width="1px" border-color="#F3F4F6" padding-bottom="32px" css-class="dark-border" />

      <mj-text align="left" css-class="heading-text dark-heading" color="#111827" padding-bottom="20px" font-weight="bold">
        🔥 Trending Now
      </mj-text>

      <mj-text padding="0" padding-bottom="20px">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="80" style="width: 80px; vertical-align: top;">
              <img src="${product1Url}" alt="Premium Kundan Bridal Set" width="80" height="80" style="border-radius: 8px; border: 1px solid #F3F4F6; display: block;" />
            </td>
            <td style="padding-left: 16px; vertical-align: middle;">
              <p style="margin: 0 0 4px 0; font-size: 16px; font-weight: bold; color: #111827;" class="dark-heading">Premium Kundan Bridal Set</p>
              <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: bold; color: #D97706;">₹1,499</p>
              <a href="${env.CLIENT_URL}/shop" style="color: #D97706; font-size: 14px; font-weight: bold; text-decoration: none;">Shop Now &rarr;</a>
            </td>
          </tr>
        </table>
      </mj-text>

      <mj-text padding="0" padding-bottom="20px">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="80" style="width: 80px; vertical-align: top;">
              <img src="${product2Url}" alt="Rose Gold American Diamond" width="80" height="80" style="border-radius: 8px; border: 1px solid #F3F4F6; display: block;" />
            </td>
            <td style="padding-left: 16px; vertical-align: middle;">
              <p style="margin: 0 0 4px 0; font-size: 16px; font-weight: bold; color: #111827;" class="dark-heading">American Diamond Bangle</p>
              <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: bold; color: #D97706;">₹899</p>
              <a href="${env.CLIENT_URL}/shop" style="color: #D97706; font-size: 14px; font-weight: bold; text-decoration: none;">Shop Now &rarr;</a>
            </td>
          </tr>
        </table>
      </mj-text>
      
      <mj-text padding="0" padding-bottom="32px">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="80" style="width: 80px; vertical-align: top;">
              <img src="${product3Url}" alt="Traditional Glass Bangle Set" width="80" height="80" style="border-radius: 8px; border: 1px solid #F3F4F6; display: block;" />
            </td>
            <td style="padding-left: 16px; vertical-align: middle;">
              <p style="margin: 0 0 4px 0; font-size: 16px; font-weight: bold; color: #111827;" class="dark-heading">Traditional Glass Set</p>
              <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: bold; color: #D97706;">₹499</p>
              <a href="${env.CLIENT_URL}/shop" style="color: #D97706; font-size: 14px; font-weight: bold; text-decoration: none;">Shop Now &rarr;</a>
            </td>
          </tr>
        </table>
      </mj-text>

      <mj-text align="left" css-class="small-text dark-muted" color="#9CA3AF" padding-top="16px">
        If you have any questions or need assistance, simply reply to this email or visit our <a href="${env.CLIENT_URL}/support" class="footer-link">Support Center</a>.
      </mj-text>
  `;

  return await baseEmailLayout("Welcome to Reshma Bangles!", content);
};

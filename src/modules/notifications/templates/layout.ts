import env from "@config/env";
import mjml2html from "mjml";
import logger from "@config/logger";

/**
 * Master Email Layout - Industry Standard (Phase 1)
 * Features: Dark Mode, Responsive Typography, Handcrafted Aesthetics, Social & Gradients
 */
export const baseEmailLayout = async (
  title: string,
  content: string,
): Promise<string> => {
  const currentYear = new Date().getFullYear();
  const logoUrl =
    "https://res.cloudinary.com/dl9bfojiu/image/upload/reshma_boutique_logo_hyvmk9.png";

  // Hand-drawn star accent for the footer
  const starAccentUrl =
    "https://res.cloudinary.com/dl9bfojiu/image/upload/star_icon_try9vy.png";

  // Safely extract raw email
  const rawEmailMatch = env.EMAIL_FROM.match(/<([^>]+)>/);
  const cleanSupportEmail = rawEmailMatch ? rawEmailMatch[1] : env.EMAIL_FROM;

  const mjmlTemplate = `
  <mjml>
    <mj-head>
      <mj-title>${title}</mj-title>
      <mj-attributes>
        <mj-all font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" />
        <mj-text padding="0" />
      </mj-attributes>
      <mj-style>
        /* Responsive Typography (Mobile First) */
        .body-text div { font-size: 15px !important; line-height: 1.5 !important; }
        .heading-text div { font-size: 24px !important; line-height: 1.3 !important; }
        .small-text div { font-size: 11px !important; line-height: 1.4 !important; }

        /* Desktop Typography Overrides */
        @media only screen and (min-width: 480px) {
          .body-text div { font-size: 16px !important; }
          .heading-text div { font-size: 28px !important; }
          .small-text div { font-size: 12px !important; }
          .email-wrapper { padding: 40px 20px !important; }
        }

        /* Essential Brand Utilities */
        .footer-link { color: #D97706 !important; text-decoration: none; font-weight: bold; }
        .unsub-link { color: #9CA3AF !important; text-decoration: underline; }

        /* Premium Gradients (Section 7) */
        .btn-gradient a { background: linear-gradient(135deg, #D97706 0%, #B45309 100%) !important; }
        .hero-overlay { background: linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(17,24,39,0.8) 100%) !important; }

        /* 🔥 Dark Mode Overrides */
        @media (prefers-color-scheme: dark) {
          .dark-bg > table, .dark-bg { background-color: #1A1A1A !important; }
          .dark-card > table, .dark-card { background-color: #2D2D2D !important; }
          .dark-text div, .dark-text span, .dark-text p { color: #E5E5E5 !important; }
          .dark-heading div { color: #FFFFFF !important; }
          .dark-muted div { color: #9CA3AF !important; }
          .dark-border { border-color: #444444 !important; }
        }
      </mj-style>
    </mj-head>

    <mj-body background-color="#FEF9F2" css-class="dark-bg">
      <mj-wrapper padding="20px 10px" css-class="email-wrapper dark-bg">
        
        <mj-section background-color="#FFFFFF" border-radius="8px 8px 0 0" padding="30px 0 20px 0" border-bottom="1px solid #FDE68A" css-class="dark-card dark-border">
          <mj-column width="100%">
            <mj-image src="${logoUrl}" alt="Reshma Bangles &amp; Boutique" width="180px" align="center" />
            <mj-text align="center" color="#D97706" font-size="12px" font-weight="600" padding-top="12px" letter-spacing="1px" text-transform="uppercase">
              ✨ Handcrafted Elegance ✨
            </mj-text>
          </mj-column>
        </mj-section>

        <mj-section background-color="#FFFFFF" padding="40px 30px" css-class="dark-card">
          <mj-column width="100%">
            ${content}
          </mj-column>
        </mj-section>

        <mj-section background-color="#FEF9F2" border-radius="0 0 8px 8px" padding="30px 20px" css-class="dark-bg">
          <mj-column width="100%">
            
            <mj-image src="${starAccentUrl}" alt="✨" width="24px" align="center" padding-bottom="20px" />

            <mj-social font-size="15px" icon-size="24px" mode="horizontal" padding-bottom="20px" align="center">
              <mj-social-element name="instagram" href="${env.CLIENT_URL}" background-color="#9CA3AF" border-radius="50%"></mj-social-element>
              <mj-social-element name="facebook" href="${env.CLIENT_URL}" background-color="#9CA3AF" border-radius="50%"></mj-social-element>
              <mj-social-element name="twitter" href="${env.CLIENT_URL}" background-color="#9CA3AF" border-radius="50%"></mj-social-element>
            </mj-social>

            <mj-text align="center" css-class="small-text dark-muted" color="#9CA3AF" padding-bottom="10px">
              Need help? Reply to this email or contact us at <br/> <a href="mailto:${cleanSupportEmail}" class="footer-link">${cleanSupportEmail}</a>
            </mj-text>
            
            <mj-text align="center" css-class="small-text dark-muted" color="#9CA3AF" padding-bottom="5px">
              &copy; ${currentYear} Reshma Bangles. All rights reserved.
            </mj-text>
            
            <mj-text align="center" css-class="small-text dark-muted" color="#9CA3AF" padding-bottom="20px">
              23 S.D.B Street, Paikpara, Bhadreswar - 712125
            </mj-text>

            <mj-text align="center" css-class="small-text dark-muted" color="#9CA3AF">
              You are receiving this email because you opted in via our website.<br/>
              <a href="${env.CLIENT_URL}/account/preferences" class="unsub-link">Update Preferences</a> | <a href="${env.CLIENT_URL}/account/preferences" class="unsub-link">Unsubscribe</a>
            </mj-text>

          </mj-column>
        </mj-section>

      </mj-wrapper>
    </mj-body>
  </mjml>
  `;

  try {
    const { html, errors } = await mjml2html(mjmlTemplate, {
      validationLevel: "soft",
    });
    if (errors && errors.length > 0)
      logger.warn(`[MJML Compiler] Warnings generated for layout:`, errors);
    return html;
  } catch (error) {
    logger.error(
      "[MJML Compiler] Critical failure generating email HTML",
      error,
    );
    return `<html><body><h1>${title}</h1><div>${content}</div></body></html>`;
  }
};

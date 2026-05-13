import { baseEmailLayout } from "./layout";
import env from "@config/env";

export const passwordResetTemplate = async (
  firstname: string,
  resetToken: string,
): Promise<string> => {
  const resetUrl = `${env.CLIENT_URL}/auth/reset-password?token=${resetToken}`;

  const content = `
      <mj-text align="left" css-class="heading-text dark-heading" color="#111827" padding-bottom="16px" font-weight="bold">
        🔒 Reset Your Password
      </mj-text>
      
      <mj-text align="left" css-class="body-text dark-text" color="#4B5563" padding-bottom="32px">
        Hi ${firstname},<br><br>
        We received a request to reset the password associated with your Reshma Bangles account. If you made this request, please click the button below to set a new, secure password.
      </mj-text>
      
      <mj-button href="${resetUrl}" background-color="#D97706" color="#FFFFFF" font-size="16px" font-weight="bold" border-radius="8px" width="100%" inner-padding="14px 28px" padding-bottom="32px">
        Reset Password
      </mj-button>

      <mj-text align="left" css-class="small-text dark-muted" color="#EF4444" padding-bottom="32px" font-weight="600">
        ⏳ For your security, this link will expire in 15 minutes.
      </mj-text>

      <mj-divider border-width="1px" border-color="#F3F4F6" padding-bottom="32px" css-class="dark-border" />

      <mj-text align="left" css-class="small-text dark-muted" color="#9CA3AF" line-height="1.5">
        <strong>Didn't request this?</strong><br>
        If you did not request a password reset, you can safely ignore this email. Your password will not change. If you believe your account has been compromised, please <a href="${env.CLIENT_URL}/support" class="footer-link">contact our support team</a> immediately.
      </mj-text>
  `;

  return await baseEmailLayout("Reset Your Password - Reshma Bangles", content);
};

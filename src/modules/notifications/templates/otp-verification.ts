import { baseEmailLayout } from "./layout";

/**
 * Generates the HTML for the Email Verification OTP.
 * @param firstname - The user's first name for personalization.
 * @param otp - The 6-digit one-time password.
 * @param expiryTimeIso - The exact ISO timestamp when the Redis key expires.
 */
export const otpVerificationTemplate = async (
  firstname: string,
  otp: string,
  expiryTimeIso: string,
): Promise<string> => {
  // Convert the ISO string to a highly readable local time (e.g., "10:45 PM")
  const exactExpiryTime = new Date(expiryTimeIso).toLocaleTimeString("en-IN", {
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });

  const content = `
      <mj-text align="left" css-class="heading-text dark-heading" color="#111827" padding-bottom="16px" font-weight="bold">
        🔒 Verify Your Email
      </mj-text>
      
      <mj-text align="left" css-class="body-text dark-text" color="#4B5563" padding-bottom="32px">
        Welcome to the family, ${firstname}! To secure your account and complete your registration, please use the verification code below.
      </mj-text>
      
      <mj-text padding="0" padding-bottom="32px">
        <div style="background-color: #FEF3C7; border: 2px dashed #D97706; border-radius: 8px; padding: 20px; text-align: center; margin: 0 auto; max-width: 250px;">
          <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: bold; color: #B45309; letter-spacing: 8px;">
            ${otp}
          </span>
        </div>
      </mj-text>
      
      <mj-text align="left" css-class="small-text dark-muted" color="#EF4444" padding-bottom="32px" font-weight="600">
        ⏳ This code will expire at exactly ${exactExpiryTime}.
      </mj-text>

      <mj-text align="left" css-class="small-text dark-muted" color="#9CA3AF" line-height="1.5">
        If you did not request this verification, please ignore this email. Your account remains completely safe.
      </mj-text>
  `;

  return await baseEmailLayout("Verify Your Email - Reshma Bangles", content);
};

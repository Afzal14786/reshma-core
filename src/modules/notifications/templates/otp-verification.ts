import { baseEmailLayout } from "./layout";

/**
 * Generates the HTML for the Email Verification OTP.
 * @param firstname - The user's first name for personalization.
 * @param otp - The 6-digit one-time password.
 */
export const otpVerificationTemplate = (firstname: string, otp: string): string => {
  const content = `
      <h2 style="margin-top: 0; color: #111827; font-size: 24px;">Welcome to Reshma Bangles, ${firstname}!</h2>
      <p style="color: #4b5563; font-size: 16px;">
          Thank you for registering with us. To secure your account and complete your registration, 
          please use the verification code below.
      </p>
      
      <div style="background-color: #fef3c7; border: 1px dashed #d97706; border-radius: 6px; padding: 20px; text-align: center; margin: 30px 0;">
          <span style="font-size: 32px; font-weight: bold; color: #b45309; letter-spacing: 4px;">${otp}</span>
      </div>
      
      <p style="color: #4b5563; font-size: 14px; margin-bottom: 0;">
          <strong>Note:</strong> This code will expire in 10 minutes. If you did not request this verification, 
          please ignore this email.
      </p>
  `;

  return baseEmailLayout("Verify Your Email - Reshma Bangles", content);
};
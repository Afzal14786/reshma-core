import { z } from 'zod';

export const VerifyOtpSchema = z.object({
    email: z.string().email("Invalid email format").toLowerCase().trim(),
    otp: z.string().length(6, "OTP must be exactly 6 digits").regex(/^\d+$/, "OTP must contain only numbers"),
});

export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>;
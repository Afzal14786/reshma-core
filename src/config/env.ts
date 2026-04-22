import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Global Environment Configuration
 * * * ARCHITECTURE NOTE:
 * We use the "Fail-Fast" boot philosophy. By wrapping `process.env` in a strict 
 * Zod schema, if a DevOps engineer forgets to inject a critical secret (like the JWT key) 
 * into the production container, the server crashes instantly with a clear error 
 * BEFORE accepting any user traffic, preventing silent security failures.
 */
const envSchema = z.object({
  PORT: z.string().default('5000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CLIENT_URL: z.string().url(),
  ADMIN_URL: z.string().url(),

  MONGO_URI: z.string().min(1, "MongoDB connection string is required"),

  // --- Two-Token Security Architecture ---
  // Access tokens are short-lived and live in React memory to prevent XSS.
  JWT_ACCESS_SECRET: z.string().min(10, "Access Secret must be at least 10 characters long"),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'), 

  // Refresh tokens are long-lived and live in HttpOnly cookies to prevent CSRF and XSS.
  JWT_REFRESH_SECRET: z.string().min(10, "Refresh Secret must be at least 10 characters long"),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'), 

  GOOGLE_CLIENT_ID: z.string().min(1, "Google Client ID is required"),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),
  
  // --- External Providers ---
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),

  REDIS_PASSWORD: z.string().optional(),
  REDIS_URL: z.string().default("redis://localhost:6379"),

  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().default(587),  
  SMTP_USER: z.string().email(),
  SMTP_PASS: z.string().min(1),
  EMAIL_FROM: z.string().min(1),

  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables:', JSON.stringify(parsedEnv.error.format(), null, 2));
  process.exit(1);
}

const env = parsedEnv.data;
export default env;
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Zod schema for strict environment variable validation.
 * Ensures the server crashes immediately at startup if required variables are missing.
 */
const envSchema = z.object({
  PORT: z.string().default('5000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CLIENT_URL: z.string().url(),
  ADMIN_URL: z.string().url(),

  MONGO_URI: z.string().min(1, "MongoDB connection string is required"),

  JWT_SECRET: z.string().min(10, "JWT Secret must be at least 10 characters long"),
  JWT_EXPIRES_IN: z.string().default('7d'),

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
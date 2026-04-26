import Razorpay from "razorpay";
import env from "./env";

/**
 * Global Razorpay Integration Configuration
 * * ARCHITECTURE NOTE:
 * Utilizing the Singleton pattern for 3rd party SDKs. This ensures we only read from
 * the process environment variables once at server startup. Bound strictly to the Zod-validated `env`.
 */
export const razorpay = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID,
  key_secret: env.RAZORPAY_KEY_SECRET,
});

export default razorpay;

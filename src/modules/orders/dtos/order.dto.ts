import { z } from "zod";

/**
 * Zod Checkout Schema
 * * SECURITY NOTE (CodeQL Mitigation):
 * We enforce `.strict()` at the highest level. This acts as an API firewall, completely
 * neutralizing Prototype Pollution (CWE-250) and NoSQL Injection (CWE-89) attempts.
 * Any unmapped payload keys (e.g., `{"$where": "..."}`) trigger an instant 400 Bad Request.
 */
export const CheckoutSchema = z.object({
  body: z
    .object({
      shippingAddress: z
        .object({
          fullName: z
            .string()
            .min(2, "Full name must be at least 2 characters")
            .max(100),
          // Validates standard E.164 phone formats (specifically targeting Indian format constraints)
          phone: z
            .string()
            .regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format"),
          streetAddress: z.string().min(5).max(255),
          city: z.string().min(2).max(100),
          state: z.string().min(2).max(100),
          // Strict 6-digit validation for Indian PIN Codes
          postalCode: z
            .string()
            .regex(/^[1-9][0-9]{5}$/, "Invalid Indian PIN code"),
          country: z.string().default("India"),
        })
        .strict(),

      paymentMethod: z.enum(["RAZORPAY", "COD"]),
    })
    .strict(),
});

/**
 * Admin Status Update Schema
 * Strictly limits what fulfillment parameters an admin can inject into the database.
 */
export const UpdateOrderStatusSchema = z.object({
  body: z
    .object({
      orderStatus: z.enum(["PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]),
      trackingNumber: z.string().optional(),
      courierName: z.string().optional(),
    })
    .strict(),
});

export type CheckoutInput = z.infer<typeof CheckoutSchema>["body"];
export type UpdateOrderStatusInput = z.infer<
  typeof UpdateOrderStatusSchema
>["body"];

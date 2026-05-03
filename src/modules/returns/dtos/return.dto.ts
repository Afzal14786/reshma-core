import { z } from "zod";
import { ReturnReason, ReturnStatus } from "../interfaces/return.interface";

/**
 * Validates a standard 24-character MongoDB Hex String.
 * Defends against NoSQL injection payloads like { "$ne": null }.
 */
const objectIdRegex = /^[0-9a-fA-F]{24}$/;

/**
 * @security Zod Mass Assignment Firewall (Stage 1)
 * Drops any undocumented fields injected by malicious actors during initiation.
 */
export const InitiateReturnSchema = z.object({
  params: z.object({
    orderId: z.string().regex(objectIdRegex, "Invalid Order ID format"),
  }),
  body: z
    .object({
      items: z
        .array(
          z.object({
            productId: z
              .string()
              .regex(objectIdRegex, "Invalid Product ID format"),
            quantity: z.number().int().positive("Quantity must be at least 1"),
            reason: z.nativeEnum(ReturnReason, {
              message: "Invalid return reason provided.",
            }),
            customerNote: z.string().trim().max(500).optional(),
          }),
        )
        .min(1, "You must select at least one item to return"),
      // Images are uploaded via Multer/Cloudinary middleware and attached as strings
      images: z.array(z.string().url()).optional().default([]),
    })
    .strict(),
});

/**
 * @security Stage 2 Firewall: Admin Arbitration
 */
export const ArbitrateReturnSchema = z.object({
  params: z.object({
    returnId: z.string().regex(objectIdRegex, "Invalid Return ID format"),
  }),
  body: z
    .object({
      status: z.enum([ReturnStatus.APPROVED, ReturnStatus.REJECTED]),
      adminRejectionReason: z.string().trim().max(1000).optional(),
    })
    .strict()
    .refine(
      (data) => {
        // If the admin rejects the return, they MUST provide a reason for the customer email.
        if (
          data.status === ReturnStatus.REJECTED &&
          !data.adminRejectionReason
        ) {
          return false;
        }
        return true;
      },
      {
        message:
          "adminRejectionReason is legally required when rejecting a return",
        path: ["adminRejectionReason"],
      },
    ),
});

/**
 * @security Stage 3 Firewall: Admin Processing
 */
export const ProcessReturnSchema = z.object({
  params: z.object({
    returnId: z.string().regex(objectIdRegex, "Invalid Return ID format"),
  }),
});

// Export strict TypeScript types for the Controllers to consume
export type InitiateReturnInput = z.infer<typeof InitiateReturnSchema>["body"];
export type ArbitrateReturnInput = z.infer<
  typeof ArbitrateReturnSchema
>["body"];

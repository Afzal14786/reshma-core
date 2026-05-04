import { z } from "zod";
import { InteractionType } from "../interfaces/interaction.interface";

/**
 * @constant objectIdRegex
 * @description ReDoS-Safe regular expression to strictly validate MongoDB ObjectIds.
 * Prevents NoSQL injection by dropping any payload with malicious query operators.
 */
const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const CreateInteractionSchema = z
  .object({
    body: z.object({
      productId: z.string().regex(objectIdRegex, "Invalid Product ID format."),

      type: z.nativeEnum(InteractionType, {
        message: "Type is required and must be strictly 'REVIEW' or 'COMMENT'.",
      }),

      // Optional at the base level, heavily enforced in the superRefine block
      rating: z.number().min(1).max(5).optional(),

      title: z
        .string()
        .trim()
        .max(150, "Title exceeds maximum safe memory limits (150 chars).")
        .optional(),

      content: z
        .string()
        .trim()
        .min(5, "Content is too short to be meaningful.")
        .max(2000, "Content exceeds maximum safe memory limits (2000 chars)."),

      images: z
        .array(z.string().url("All images must be valid secure URLs."))
        .max(5, "You can only upload a maximum of 5 images.")
        .optional(),

      parentId: z
        .string()
        .regex(objectIdRegex, "Invalid Parent ID format.")
        .optional()
        .nullable(),
    }),
  })
  .superRefine((data, ctx) => {
    /**
     * DYNAMIC BUSINESS LOGIC FIREWALL
     */

    // Rule 1: Reviews MUST have a mathematical rating
    if (
      data.body.type === InteractionType.REVIEW &&
      data.body.rating === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A numerical rating (1-5) is strictly required for REVIEWS.",
        path: ["body", "rating"],
      });
    }

    // Rule 2: Comments MUST NOT carry a rating (Prevents manipulation of product averages)
    if (
      data.body.type === InteractionType.COMMENT &&
      data.body.rating !== undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Security Violation: Ratings are forbidden on threaded COMMENTS.",
        path: ["body", "rating"],
      });
    }

    // Rule 3: Comments MUST reference the parent they are replying to
    if (data.body.type === InteractionType.COMMENT && !data.body.parentId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A valid 'parentId' is required to post a COMMENT (reply).",
        path: ["body", "parentId"],
      });
    }

    // Rule 4: Reviews MUST NOT have a parent (They are the top of the thread)
    if (data.body.type === InteractionType.REVIEW && data.body.parentId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Security Violation: A top-level REVIEW cannot have a parent ID.",
        path: ["body", "parentId"],
      });
    }
  });

// Export inferred types for strict usage in the Controller and Service
export type TCreateInteractionBody = z.infer<
  typeof CreateInteractionSchema
>["body"];

import { z } from "zod";

/**
 * @constant objectIdRegex
 * @description ReDoS-Safe regular expression to strictly validate MongoDB ObjectIds.
 */
const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const VoteInteractionSchema = z.object({
  params: z.object({
    interactionId: z
      .string()
      .regex(objectIdRegex, "Invalid Interaction ID format."),
  }),
  body: z.object({
    /**
     * Strict action enumeration.
     * Prevents clients from sending random actions that could cause unpredictable database queries.
     */
    action: z.enum(["LIKE", "DISLIKE"], {
      message: "Action payload must be strictly 'LIKE' or 'DISLIKE'.",
    }),
  }),
});

// Export inferred types for strict usage in the Controller
export type TVoteInteractionParams = z.infer<
  typeof VoteInteractionSchema
>["params"];
export type TVoteInteractionBody = z.infer<
  typeof VoteInteractionSchema
>["body"];

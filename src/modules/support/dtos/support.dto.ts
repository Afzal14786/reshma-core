import { z } from "zod";
import { Types } from "mongoose";
import {
  TicketCategory,
  TicketPriority,
  TicketStatus,
  LinkedEntityType,
} from "../interfaces/support.interface";

/**
 * UTILITY: MongoDB ObjectId Validator
 * Ensures strings passed in payloads are mathematically valid BSON ObjectIds
 * before they ever touch the Mongoose driver.
 */
const objectIdSchema = z.string().refine((val) => Types.ObjectId.isValid(val), {
  message: "Invalid MongoDB ObjectId format",
});

/**
 * 1. CREATE TICKET SCHEMA (Customer Facing)
 * SECURITY BOUNDARY:
 * Explicitly excludes `status`, `priority`, and `assignedAdmin` so malicious
 * users cannot escalate their own tickets or bypass the state machine.
 */
export const CreateTicketSchema = z.object({
  body: z.object({
    subject: z
      .string()
      .min(5, "Subject must be at least 5 characters long")
      .max(150, "Subject cannot exceed 150 characters"),

    category: z.nativeEnum(TicketCategory, {
      message: "Invalid ticket category selected",
    }),

    // The initial message describing the issue
    message: z
      .string()
      .min(10, "Please provide more details (minimum 10 characters)")
      .max(3000, "Message is too long. Please summarize your issue."),

    // Polymorphic Context (Optional)
    linkedEntity: z
      .object({
        entityType: z.nativeEnum(LinkedEntityType),
        entityId: objectIdSchema,
      })
      .optional(),
  }),
});

export type CreateTicketInput = z.infer<typeof CreateTicketSchema>["body"];

/**
 * 2. REPLY TICKET SCHEMA (Customer & Admin Facing)
 * Used to append a new message to the threaded conversation.
 */
export const ReplyTicketSchema = z.object({
  body: z.object({
    message: z
      .string()
      .min(2, "Reply must be at least 2 characters long")
      .max(3000, "Reply cannot exceed 3000 characters"),
  }),
});

export type ReplyTicketInput = z.infer<typeof ReplyTicketSchema>["body"];

/**
 * 3. UPDATE TICKET STATE SCHEMA (Admin Facing)
 * Used by customer support agents to escalate priority, assign staff,
 * or change the resolution status.
 */
export const UpdateTicketStateSchema = z.object({
  body: z
    .object({
      status: z.nativeEnum(TicketStatus).optional(),
      priority: z.nativeEnum(TicketPriority).optional(),
      assignedAdmin: objectIdSchema.optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message:
        "At least one field (status, priority, assignedAdmin) must be provided for an update.",
    }),
});

export type UpdateTicketStateInput = z.infer<
  typeof UpdateTicketStateSchema
>["body"];

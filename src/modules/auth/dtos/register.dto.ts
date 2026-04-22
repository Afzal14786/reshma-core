import { z } from 'zod';

/**
 * Registration DTO
 * * ARCHITECTURE NOTE:
 * We enforce strict password policies and automatically sanitize inputs (trimming whitespace, 
 * lowercasing emails) before the data ever reaches the controller.
 */
export const RegisterSchema = z.object({
    body: z.object({
        firstname: z.string().min(2, "First name must be at least 2 characters").trim(),
    lastname: z.string().min(2, "Last name must be at least 2 characters").trim(),
    email: z.string().email("Invalid email format").toLowerCase().trim(),
    password: z.string()
        .min(8, "Password must be at least 8 characters long")
        .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
        .regex(/[0-9]/, "Password must contain at least one number"),
    // Transform strips all spaces and hyphens from the phone number
    phone: z.string().transform((val) => val.replace(/[\s-]/g, '')).optional()
    }) 
});

export type RegisterInput = z.infer<typeof RegisterSchema>["body"];
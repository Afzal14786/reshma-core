import {z} from "zod";

/**
 * Domain Transfer Objects (DTO): Authentication
 * * ARCHITECTURE NOTE:
 * By strictly defining these shapes with Zod, we guarantee that no malicious payload 
 * (like an attacker trying to inject `role: 'ADMIN'` during registration) ever reaches 
 * our database. The validation middleware will automatically strip unlisted fields.
 */


export const LoginSchema = z.object({
    body: z.object({
        email: z.string().email("Invalid email format").toLowerCase().trim(),
        password: z.string().min(1, "Password is required"),
    }),
});

export type LoginInput = z.infer<typeof LoginSchema>["body"];
import { Request, Response, NextFunction } from "express";
import { HTTP_STATUS } from "@shared/constant/http-codes";
import { AppError } from "@shared/utils/app-error";
import { ZodSchema, ZodError, ZodIssue } from "zod";

/**
 * Validation Interceptor
 * * ARCHITECTURE NOTE:
 * This acts as an absolute firewall before our controllers. By passing a Zod schema, 
 * we guarantee that the request body, query parameters, and URL parameters strictly 
 * match our domain interfaces. It automatically strips out malicious payload injections 
 * (like a user trying to send `role: 'ADMIN'` during registration).
 */
export const validate = (schema: ZodSchema) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const validatedData = await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params
            }) as {
                body: Request['body'];
                query: Request['query'];
                params: Request['params'];
            };
 
            // Reassign the strictly validated and stripped data back to the request
            req.body = validatedData.body;
            req.query = validatedData.query;
            req.params = validatedData.params;

            next();

        } catch (error: unknown) {
            // Type Narrowing
            if (error instanceof ZodError) {
                const zodError = error as ZodError;
                const errorMessages = zodError.issues
                    .map((issue: ZodIssue) => `${issue.path.join('.')} is ${issue.message}`)
                    .join(', ');
                
                next(new AppError(HTTP_STATUS.BAD_REQUEST, `Validation Failed: ${errorMessages}`));
            } else {
                // If it's a different server error, pass it to the global error handler
                next(error);
            }
        }
    };
};
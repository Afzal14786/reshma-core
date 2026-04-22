import { Request, Response, NextFunction } from "express";
import { HTTP_STATUS } from "@shared/constant/http-codes";
import { AppError } from "@shared/utils/app-error";
import { ZodSchema, ZodError, ZodIssue } from "zod";

/**
 * Validation Interceptor
 * * ARCHITECTURE NOTE:
 * This acts as an absolute firewall before our controllers. By passing a Zod schema, 
 * we guarantee that the request body, query parameters, and URL parameters strictly 
 * match our domain interfaces. It automatically strips out malicious payload injections.
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
 
            // 1. Body can still be reassigned directly via body-parser
            if (validatedData.body) {
                req.body = validatedData.body;
            }

            // 2. Express 5.x Fix: Bypass the getter using Object.defineProperty
            if (validatedData.query) {
                Object.defineProperty(req, 'query', { 
                    value: validatedData.query, 
                    enumerable: true 
                });
            }
            
            if (validatedData.params) {
                Object.defineProperty(req, 'params', { 
                    value: validatedData.params, 
                    enumerable: true 
                });
            }

            next();

        } catch (error: unknown) {
            if (error instanceof ZodError) {
                const errorMessages = error.issues
                    .map((issue: ZodIssue) => {
                        // Get the last part of the path (e.g., "body.firstname" -> "firstname")
                        const rawField = issue.path[issue.path.length - 1];

                        const fieldName = rawField !== undefined ? String(rawField) : 'Field';
                        return `${fieldName}: ${issue.message}`;
                    })
                    .join(', ');
                
                next(new AppError(HTTP_STATUS.BAD_REQUEST, `Validation Failed: ${errorMessages}`));
            } else {
                next(error);
            }
        }
    };
};
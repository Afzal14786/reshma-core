import { Request, Response, NextFunction } from "express";
import { HTTP_STATUS } from "@shared/constant/http-codes";
import { AppError } from "@shared/utils/app-error";
import { ZodError, ZodIssue, ZodObject } from "zod";
import { Sanitizer } from "@shared/utils/sanitizer";

/**
 * Validation Interceptor (Express 5.x Compatible)
 * * ARCHITECTURE NOTE:
 * This acts as an absolute firewall before our controllers. It enforces two layers
 * of defense-in-depth:
 * 1. NoSQL Injection Sanitization: Strips keys starting with '$' or '.' via the Sanitizer utility.
 * 2. Zod Schema Validation: Enforces strict domain types and strips undocumented fields.
 * * * Express 5.x Compatibility:
 * In Express 5, 'req.query' and 'req.params' are read-only getters. We utilize
 * 'Object.defineProperty' to bypass the setter restriction and inject the sanitized/validated data.
 * * @param schema - The Zod schema representing the body, query, and params.
 */
export const validate = (schema: ZodObject<any>) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      // 1. INPUT SANITIZATION (NoSQL Injection Defense)
      // We spread the original objects to create shallow clones.
      // The Sanitizer deep-cleans these clones to bypass Express 5's read-only getters.
      const cleanQuery = Sanitizer.sanitize({ ...req.query });
      const cleanBody = Sanitizer.sanitize({ ...req.body });
      const cleanParams = Sanitizer.sanitize({ ...req.params });

      // 2. SCHEMA VALIDATION
      // parseAsync validates the data against our Zod schema.
      // It will throw a ZodError if any data violates the defined constraints.
      const validatedData = await schema.parseAsync({
        body: cleanBody,
        query: cleanQuery,
        params: cleanParams,
      });

      // 3. DATA REASSIGNMENT
      // Update req.body directly (it remains writable).
      if (validatedData.body !== undefined) {
        req.body = validatedData.body;
      }

      // Update req.query and req.params using Object.defineProperty to bypass Express 5 getters.
      if (validatedData.query !== undefined) {
        Object.defineProperty(req, "query", {
          value: validatedData.query,
          enumerable: true,
          configurable: true,
        });
      }

      if (validatedData.params !== undefined) {
        Object.defineProperty(req, "params", {
          value: validatedData.params,
          enumerable: true,
          configurable: true,
        });
      }

      next();
    } catch (error: unknown) {
      // 4. ERROR ARBITRATION
      // If the error came from Zod, we format the issues into a readable, flat string.
      if (error instanceof ZodError) {
        const errorMessages = error.issues
          .map((issue: ZodIssue) => {
            // Extract the specific field name from the end of the validation path
            const rawField = issue.path[issue.path.length - 1];
            const fieldName =
              rawField !== undefined ? String(rawField) : "Field";
            return `${fieldName}: ${issue.message}`;
          })
          .join(", ");

        next(
          new AppError(
            HTTP_STATUS.BAD_REQUEST,
            `Validation Failed: ${errorMessages}`,
          ),
        );
      } else {
        // Pass system or unexpected errors down to the Global Error Handler
        next(error);
      }
    }
  };
};

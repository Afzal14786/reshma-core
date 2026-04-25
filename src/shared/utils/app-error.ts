/**
 * Core Application Error Class
 * * ARCHITECTURE NOTE:
 * We throw this class instead of the standard built-in `Error` object so our
 * global error-handling middleware can easily distinguish between "Expected Errors"
 * (like a user entering the wrong password) and "Unexpected Bugs" (like a database crash).
 */
export class AppError extends Error {
  public statusCode: number;
  public status: string;

  // A crucial flag. If true, it means we predicted this error (e.g., Validation Failed),
  // and it is safe to send the error message directly to the React frontend.
  // If false, it's an unhandled bug, and we should hide the details from the user.
  public isOperational: boolean;

  constructor(statusCode: number, message: string) {
    // Pass the message to the parent Error class
    super(message);

    this.statusCode = statusCode;

    // Automatically determine the status string for frontend parsing.
    // 4xx codes (Client Errors) are "fail". 5xx codes (Server Errors) are "error".
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;

    // Preserves the exact line of code where the error occurred in the stack trace,
    // explicitly omitting this constructor call from the logs to keep them clean.
    Error.captureStackTrace(this, this.constructor);
  }
}

import { Request, Response, NextFunction } from "express";
import { HTTP_STATUS } from "@shared/constant/http-codes";
import { AppError } from "@shared/utils/app-error";
import logger from "@config/logger";
import env from "@config/env";
import { Error as MongooseError } from "mongoose";

/**
 * Interface for MongoDB Driver Errors
 * Specifically used to catch unique constraint violations (code: 11000)
 */
interface MongoServerError extends Error {
  code: number;
  keyValue?: Record<string, unknown>;
}

/**
 * Global Error Handling Pipeline
 * * ARCHITECTURE NOTE:
 * In an e-commerce environment, database errors (like unique constraint failures on emails)
 * or internal server crashes must be caught here. We sanitize the errors before sending
 * them to the client to prevent exposing stack traces or database internal structures.
 * * * TYPE SAFETY NOTE:
 * We accept `err: unknown` because third-party libraries can throw literally anything
 * (strings, objects, null). We use `instanceof` to safely narrow the type without
 * ever using the 'any' keyword.
 */
export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  let statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR;
  let message = "Something went wrong on the server";
  let isOperational = false;
  let stack: string | undefined = undefined;

  if (err instanceof Error) {
    message = err.message;
    stack = err.stack;

    if (err instanceof AppError) {
      statusCode = err.statusCode;
      isOperational = err.isOperational;
    } else if (err instanceof MongooseError.CastError) {
      statusCode = HTTP_STATUS.BAD_REQUEST;
      message = `Resource not found. Invalid ${err.path} : ${err.value}`;
      isOperational = true;
    } else if (err instanceof MongooseError.ValidationError) {
      statusCode = HTTP_STATUS.BAD_REQUEST;
      message = `Invalid input data: ${Object.values(err.errors)
        .map((val) => val.message)
        .join(", ")}`;
      isOperational = true;
    } else if (
      err.name === "MongoServerError" &&
      (err as MongoServerError).code === 11000
    ) {
      statusCode = HTTP_STATUS.CONFLICT;
      const mongoErr = err as MongoServerError;
      const duplicateField = mongoErr.keyValue
        ? Object.keys(mongoErr.keyValue)[0]
        : "field";
      message = `The ${duplicateField} you entered already exists. Please use another value.`;
      isOperational = true;
    }
  } else if (typeof err === "string") {
    message = err;
  }

  if (env.NODE_ENV !== "test" && !isOperational) {
    logger.error(`[Unhandled Error] ${message}`, { stack, path: req.path });
  }

  res.status(statusCode).json({
    success: false,
    statusCode,
    // In production, hide the actual message if it's a non-operational database crash
    message:
      isOperational || env.NODE_ENV === "development"
        ? message
        : "Internal Server Error",
    // Strip the stack trace in production to prevent reverse-engineering
    ...(env.NODE_ENV === "development" && { stack }),
  });
};

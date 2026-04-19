import { Response } from "express";

/**
 * Standardized API Response Wrapper
 * * ARCHITECTURE NOTE:
 * Consistency is critical for frontend developers. By forcing every single controller 
 * to use this class, we guarantee that the Next.js/React team will always receive the 
 * exact same JSON structure, regardless of which endpoint they hit. They never have 
 * to guess if the data is inside `res.data`, `res.payload`, or `res.user`.
 * * @template T - The strict TypeScript type of the data payload being returned.
 */
export class ApiResponse<T> {
  constructor(
    private res: Response,
    private statusCode: number,
    private message: string,
    private data: T,
  ) {}

  /**
   * Dispatches the final JSON payload to the client.
   * * It automatically calculates the `success` boolean so the frontend 
   * doesn't have to manually parse HTTP status codes to know if the request worked.
   */
  public send(): Response {
    return this.res.status(this.statusCode).json({
      // Automatically true for 200, 201, etc. False for anything else.
      success: this.statusCode >= 200 && this.statusCode < 300,
      statusCode: this.statusCode,
      message: this.message,
      data: this.data,
      
      // Injecting a timestamp helps frontend apps handle caching, data synchronization, 
      // and debugging race conditions during high-traffic checkout events.
      timestamp: new Date().toISOString(),
    });
  }
}
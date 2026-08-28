import { Request } from "express";
import { Types } from "mongoose";
import { IUser } from "@modules/users/interfaces/user.interface";

/**
 * Audit Context Type
 */
export interface IAuditContext {
  adminId: Types.ObjectId;
  adminEmail: string;
  adminName: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Extracts Admin identity and network context from the Express Request.
 *
 * @param req - The Express Request (populated by `protect` middleware).
 * @returns {IAuditContext | null} - Context object, or null if `req.user` is missing.
 *
 * PRODUCTION-GRADE FEATURES:
 * - Handles `x-forwarded-for` headers for proxy/load-balancer environments.
 * - Truncates `userAgent` to 500 characters to prevent database storage bloat.
 * - Defensively returns `null` if user is not authenticated.
 *
 * TYPE SAFETY: Uses conditional spread to satisfy `exactOptionalPropertyTypes`.
 */
export const getAuditContext = (req: Request): IAuditContext | undefined => {
  // Extract user from request (populated by `protect` middleware)
  const user = req.user as IUser | undefined;
  if (!user || !user._id) {
    return undefined;
  }

  // Build Admin Identity
  const adminId = user._id;
  const adminEmail = user.email;
  const adminName = `${user.firstname || ""} ${user.lastname || ""}`.trim();

  // Extract IP Address (Handles Proxies)
  let ipAddress = req.ip;
  const forwarded = req.headers["x-forwarded-for"] as string | undefined;
  if (forwarded) {
    // x-forwarded-for format: client, proxy1, proxy2
    const ips = forwarded.split(",").map((ip) => ip.trim());
    ipAddress = ips[0] || req.ip;
  }
  // Fallback for edge cases
  if (!ipAddress) {
    ipAddress = req.socket?.remoteAddress || req.connection?.remoteAddress;
  }

  // Extract and Truncate User-Agent (Prevents 500 char DB limit overflow)
  let userAgent = req.headers["user-agent"] as string | undefined;
  if (userAgent && userAgent.length > 500) {
    userAgent = userAgent.substring(0, 500);
  }

  // Return context with optional fields conditionally included
  return {
    adminId: adminId as Types.ObjectId,
    adminEmail,
    adminName,
    ...(ipAddress ? { ipAddress } : {}),
    ...(userAgent ? { userAgent } : {}),
  };
};

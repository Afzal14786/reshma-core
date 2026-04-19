import {Request, Response, NextFunction} from "express";
import jwt from "jsonwebtoken";
import { User } from "@modules/users/user.model";
import { AppError } from "@shared/utils/app-error";
import env from "@config/env";
import { HTTP_STATUS } from "@shared/constant/http-codes";

/**
 * JWT Payload Interface
 * Ensures strict typing when decoding the token.
 */
interface IJwtPayload extends jwt.JwtPayload {
    id: string;
}

/**
 * The Identity Gatekeeper (Authentication)
 * * ARCHITECTURE NOTE:
 * This middleware sits in front of all protected routes (e.g., /api/v1/users/me, /api/v1/orders/checkout).
 * It extracts the JWT, cryptographically verifies it, and mounts the full User document to `req.user`.
 * It intentionally supports BOTH HTTP-Only Cookies (for Web security against XSS) AND 
 * Bearer Tokens (for Mobile App flexibility).
 */

export const protect = async (req: Request, res: Response, next: NextFunction) => {
    try {
        let token: string | undefined;
        /**
         * Extract token from header or cookies
         */

        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            token = req.headers.authorization.split(' ')[1];
        } else if (req.cookies && req.cookies.jwt) {
            token = req.cookies.jwt;
        }

        if (!token) {
            throw new AppError(HTTP_STATUS.UNAUTHORIZED, "You are not logged in");
        }

        const decode = jwt.verify(token, env.JWT_SECRET) as IJwtPayload;
        // user should present 
        const currentUser = await User.findById(decode._id);

        if (!currentUser) {
            throw new AppError(HTTP_STATUS.UNAUTHORIZED, "The user belonging to this token is no longer exist");
        }

        if (!currentUser.isActive) {
            throw new AppError(HTTP_STATUS.FORBIDDEN, "Your account has been deactivate. Please contact support");
        }

        req.user = currentUser;
        next();

    } catch(error) {
        if (error instanceof jwt.TokenExpiredError) {
            next(new AppError(HTTP_STATUS.UNAUTHORIZED, "Your session is expired, please login again"));
        } else if (error instanceof jwt.JsonWebTokenError) {
            next(new AppError(HTTP_STATUS.UNAUTHORIZED, "Invalid token, please login again"));
        } else {
            next(error);
        }
    }
};
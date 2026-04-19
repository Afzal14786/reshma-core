import {Request, Response, NextFunction} from "express";
import { AppError } from "@shared/utils/app-error";
import { HTTP_STATUS } from "@shared/constant/http-codes";
import { UserRole } from "@modules/users/interface/user.interface";

/**
 * The RBAC Gatekeeper (Authorization)
 * * ARCHITECTURE NOTE:
 * This middleware MUST be chained *after* the `protect` middleware.
 * It assumes `req.user` has already been populated. It checks if the authenticated 
 * user's role exists within the allowed roles array. If not, it blocks the request.
 * * @example
 * router.post('/products', protect, restrictTo('ADMIN'), createProductController);
 */

export const restrictTo = (...roles: UserRole[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        // Failsafe: This should theoretically never happen if 'protect' ran first, 
        // but TypeScript strict mode requires us to check.
        if (!req.user) {
            return next(new AppError(HTTP_STATUS.UNAUTHORIZED, "Authentication required to verify permissions"));
        }

        if (!roles.includes(req.user.role)) {
            return next(new AppError(HTTP_STATUS.FORBIDDEN, "You do not have permission to perform this action"));
        }

        next();
    }
}
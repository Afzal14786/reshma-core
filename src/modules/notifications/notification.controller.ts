import { Request, Response, NextFunction } from 'express';
import { NotificationService } from './notification.service';
import { ApiResponse } from '@shared/utils/api-response';
import { HTTP_STATUS } from '@shared/constant/http-codes';
import { AppError } from '@shared/utils/app-error';
import logger from '@config/logger';

/**
 * Notification Controller
 * * ARCHITECTURE NOTE:
 * Exposes the REST interface for the frontend to fetch and interact with 
 * the user's "Bell Icon" alerts. Email dispatching is intentionally kept 
 * out of this HTTP layer.
 */
export class NotificationController {
    
    public static async getMyNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            // Parse pagination query parameters with defaults
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const skip = (page - 1) * limit;

            // req.user is guaranteed to exist by the 'protect' middleware chain
            const notifications = await NotificationService.getUserNotifications(req.user!._id, limit, skip);

            new ApiResponse(res, HTTP_STATUS.OK, 'Notifications retrieved successfully', notifications).send();
        } catch (error) {
            next(error);
        }
    }

    public static async markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            // FIX: Explicitly cast to string to satisfy strict TypeScript bounds
            const notificationId = req.params.notificationId as string;

            // Failsafe validation
            if (!notificationId) {
                throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Notification ID is required');
            }

            const updated = await NotificationService.markAsRead(notificationId, req.user!._id);
            
            if (!updated) {
                logger.warn(`Failed to mark notification as read: Not found or unauthorized`, { 
                    notificationId, 
                    userId: req.user!._id 
                });
                throw new AppError(HTTP_STATUS.NOT_FOUND, 'Notification not found or access denied');
            }

            new ApiResponse(res, HTTP_STATUS.OK, 'Notification marked as read', updated).send();
        } catch (error) {
            next(error);
        }
    }
}
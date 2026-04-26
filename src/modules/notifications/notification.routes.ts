import { Router } from "express";
import { NotificationController } from "./notification.controller";
import { protect } from "@shared/middlewares/auth.middleware";

import { standardLimiter } from "@shared/middlewares/rate-limit.middleware";

const router = Router();

router.use(standardLimiter);

// ALL notification routes require the user to be logged in
router.use(protect);

// GET /api/v1/notifications
router.get("/", NotificationController.getMyNotifications);

// PATCH /api/v1/notifications/:notificationId/read
router.patch("/:notificationId/read", NotificationController.markRead);

export const notificationRoutes = router;

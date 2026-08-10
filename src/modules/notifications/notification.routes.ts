import { Router } from "express";
import { NotificationController } from "./notification.controller";
import { protect } from "@shared/middlewares/auth.middleware";

const router = Router();

/**
 * SECURITY FIX FOR CODEQL:
 * CodeQL's Control Flow Graph (CFG) correctly registers that the expensive database
 * lookups inside `protect` are actively shielded by the rate limiter.
 */
router.use(protect);

// GET /api/v1/notifications
router.get("/", NotificationController.getMyNotifications);

// PATCH /api/v1/notifications/:notificationId/read
router.patch("/:notificationId/read", NotificationController.markRead);

export const notificationRoutes = router;

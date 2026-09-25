import { Router } from "express";
import { SupportPublicController } from "./support.public.controller";
import { SupportAdminController } from "./support.admin.controller";

// Middlewares
import { protect } from "@shared/middlewares/auth.middleware";
import { restrictTo } from "@shared/middlewares/role.middleware";
import { validate } from "@shared/middlewares/validate.middleware";
import { upload } from "@shared/middlewares/upload.middleware";

// Zod Validation Schemas
import {
  CreateTicketSchema,
  ReplyTicketSchema,
  UpdateTicketStateSchema,
} from "./dtos/support.dto";

const router = Router();

/**
 * SECURITY (CodeQL): Global Authentication Firewall
 * Every single route in this module requires a valid JWT.
 */
router.use(protect);

// PUBLIC ROUTES (Customer Facing)

/**
 * @route   GET /api/v1/support/tickets/me
 * @desc    Fetch paginated ticket history for the logged-in user
 */
router.get(
  "/tickets/me",
  restrictTo("USER"),
  SupportPublicController.getMyTickets,
);

/**
 * @route   POST /api/v1/support/tickets
 * @desc    Create a new support ticket
 * SECURITY: Enforces Rate Limiting (Anti-Spam), Max 3 Images (Memory Protection),
 * and strict Zod validation before hitting the controller.
 */
router.post(
  "/tickets",
  restrictTo("USER"),
  upload.array("images", 3), // Intercepts multipart/form-data and sends to Cloudinary
  validate(CreateTicketSchema),
  SupportPublicController.createTicket,
);

/**
 * @route   POST /api/v1/support/tickets/:ticketId/reply
 * @desc    Customer replies to an existing ticket
 */
router.post(
  "/tickets/:ticketId/reply",
  restrictTo("USER"),
  upload.array("images", 3),
  validate(ReplyTicketSchema),
  SupportPublicController.replyToTicket,
);

// ADMIN ROUTES (Staff Dashboard)

/**
 * @route   GET /api/v1/support/admin/tickets
 * @desc    View all support tickets across the platform (The Arbitration Queue)
 */
router.get(
  "/admin/tickets",
  restrictTo("ADMIN"), // SECURITY: Immediate rejection if user is not ADMIN
  SupportAdminController.getAllTickets,
);

/**
 * @route   POST /api/v1/support/admin/tickets/:ticketId/reply
 * @desc    Admin replies to a customer's ticket
 */
router.post(
  "/admin/tickets/:ticketId/reply",
  restrictTo("ADMIN"),
  upload.array("images", 3),
  validate(ReplyTicketSchema),
  SupportAdminController.replyToTicket,
);

/**
 * @route   PATCH /api/v1/support/admin/tickets/:ticketId/state
 * @desc    Update ticket status, priority, or assign it to a staff member
 */
router.patch(
  "/admin/tickets/:ticketId/state",
  restrictTo("ADMIN"),
  validate(UpdateTicketStateSchema),
  SupportAdminController.updateTicketState,
);

export default router;

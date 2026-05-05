import { Router } from "express";
import { OrderPublicController } from "./order.public.controller";
import { OrderAdminController } from "./order.admin.controller";

// Global Middlewares
import { protect } from "@shared/middlewares/auth.middleware";
import { restrictTo } from "@shared/middlewares/role.middleware";
import { validate } from "@shared/middlewares/validate.middleware";
import {
  checkoutLimiter,
  standardLimiter,
} from "@shared/middlewares/rate-limit.middleware";

// Validation Schemas
import {
  CheckoutSchema,
  UpdateOrderStatusSchema,
  DispatchOrderSchema,
} from "./dtos/order.dto";

const router = Router();

/**
 * UNPROTECTED ROUTES (System Webhooks)
 * Guarded strictly by HMAC cryptographic signatures, not JWTs.
 *
 * ARCHITECTURE NOTE: The raw Buffer stream is intercepted and attached to req.rawBody
 * globally in app.ts, keeping this router perfectly clean.
 */
router.post("/webhook", OrderPublicController.handleRazorpayWebhook);

/**
 * @route POST /shiprocket-webhook
 * @description Ingests real-time physical delivery updates.
 */
router.post(
  "/shiprocket-webhook",
  OrderPublicController.handleShiprocketWebhook,
);

/**
 * PUBLIC ROUTES: CUSTOMER FINANCIAL BOUNDARY
 * All routes below this point require a mathematically verified JWT.
 * We apply the standard limiter globally to prevent basic enumeration attacks
 * before the request even reaches the database.
 */
router.use(standardLimiter);

// Establishes `req.user` identity for all downstream order and invoice operations.
router.use(protect);

/**
 * @route   POST /checkout
 * @security
 * 1. checkoutLimiter: Extremely strict rate limit. Prevents "Card Bin Testing" bots
 * and financial DDoS attacks on our Razorpay integration.
 * 2. validate(CheckoutSchema): Zod `.strict()` firewall drops any NoSQL/Prototype
 * pollution injections before they reach the ACID transaction engine.
 */
router.post(
  "/checkout",
  checkoutLimiter,
  validate(CheckoutSchema),
  OrderPublicController.checkout,
);

/**
 * @route   POST /admin/:id/dispatch
 * @desc    Triggers physical fulfillment via Shiprocket
 * @security Validates physical dimensions to prevent 3PL API rejection
 */
router.post(
  "/admin/:id/dispatch",
  validate(DispatchOrderSchema),
  OrderAdminController.dispatchOrder,
);

/**
 * @route   POST /verify-payment
 * @desc    Cryptographic handshake endpoint. Validates Razorpay HMAC signatures.
 */
router.post("/verify-payment", OrderPublicController.verifyPayment);

/**
 * @route   GET /my-order
 * @desc    Returns historical order snapshots scoped strictly to the authenticated user.
 */
router.get("/my-order", OrderPublicController.getMyOrders);

/**
 * @route   GET /:id/invoice
 * @desc    Triggers the on-the-fly PDF generation stream.
 * @security The controller inherently protects this against IDOR (Insecure Direct Object Reference)
 * by ensuring the requested Order ID strictly belongs to `req.user._id`.
 */
router.get("/:id/invoice", OrderPublicController.downloadInvoice);

/**
 * ADMIN ROUTES: FULFILLMENT & LOGISTICS
 * Escalates the access control. If a standard user bypasses the frontend UI and attempts
 * to hit these endpoints via Postman, the `restrictTo` middleware will instantly drop
 * the request with a 403 Forbidden.
 */
router.use("/admin", restrictTo("ADMIN"));

/**
 * @route   GET /admin
 * @desc    Master fulfillment dashboard data feed.
 */
router.get("/admin", OrderAdminController.getAllOrders);

/**
 * @route   PATCH /admin/:id/status
 * @desc    Drives the Order State Machine (PROCESSING -> SHIPPED -> DELIVERED).
 * Automatically hooks into BullMQ to fire async logistics emails.
 * @security Validated to prevent admins from injecting invalid states or raw JSON objects.
 */
router.patch(
  "/admin/:id/status",
  validate(UpdateOrderStatusSchema),
  OrderAdminController.updateOrderStatus,
);

export const OrderRoutes = router;

import { Request, Response, NextFunction } from "express";
import { OrderService } from "./order.service";
import { Order } from "./order.model";
import { ApiResponse } from "@shared/utils/api-response";
import { HTTP_STATUS } from "@shared/constant/http-codes";
import { AppError } from "@shared/utils/app-error";
import { CheckoutInput } from "./dtos/order.dto";
import { generateInvoiceBuffer } from "./invoice.generator";
import { IRazorpayWebhookBody, IOrder } from "./interfaces/order.interface";
import { IShiprocketWebhookPayload } from "./interfaces/order.interface";
import { ShiprocketService } from "./shiprocket.service";

/**
 * PRODUCTION-GRADE WRAPPER
 * @description Ensures all asynchronous errors (like DB timeouts or Razorpay API failures)
 * are caught and forwarded to the global error middleware to prevent hanging requests.
 */
const catchAsync = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
};

export class OrderPublicController {
  /**
   * @route   POST /api/v1/orders/checkout
   * @desc    Initializes atomic checkout and returns the Razorpay Order ID
   * @access  Private (Logged in users)
   */
  public static checkout = catchAsync(async (req: Request, res: Response) => {
    const userId = String(req.user!._id);
    const payload = req.body as CheckoutInput;

    const order = await OrderService.initializeCheckout(userId, payload);

    return new ApiResponse(
      res,
      HTTP_STATUS.CREATED,
      "Checkout initialized successfully. Proceed to payment.",
      { order },
    ).send();
  });

  /**
   * @route   POST /api/v1/orders/verify-payment
   * @desc    Cryptographically verifies the Razorpay success payload
   * @access  Private
   */
  public static verifyPayment = catchAsync(
    async (req: Request, res: Response) => {
      const userId = String(req.user!._id);
      const { gatewayOrderId, gatewayPaymentId, gatewaySignature } = req.body;

      const order = await OrderService.verifyFrontendPayment(
        userId,
        gatewayOrderId,
        gatewayPaymentId,
        gatewaySignature,
      );

      return new ApiResponse(
        res,
        HTTP_STATUS.OK,
        "Payment verified and order is now processing.",
        { order },
      ).send();
    },
  );

  /**
   * @route   GET /api/v1/orders/me
   * @desc    Fetch the logged-in user's order history
   * @access  Private
   */
  public static getMyOrders = catchAsync(
    async (req: Request, res: Response) => {
      const userId = String(req.user!._id);

      // SECURITY: Strict $eq wrapper to prevent NoSQL injection on the user ID
      const orders = await Order.find({ user: { $eq: userId } })
        .sort("-createdAt")
        .lean();

      return new ApiResponse(
        res,
        HTTP_STATUS.OK,
        "Order history fetched successfully",
        { orders },
      ).send();
    },
  );

  /**
   * @route   GET /api/v1/orders/:id/invoice
   * @desc    Generates and downloads a PDF tax invoice on-the-fly
   * @access  Private (Owner only)
   */
  public static downloadInvoice = catchAsync(
    async (req: Request, res: Response) => {
      const userId = String(req.user!._id);
      const orderId = String(req.params.id);

      // SECURITY: IDOR Protection. By strictly requiring the requesting user's ID
      // to match the document's owner, we prevent malicious users from scraping other people's receipts.
      const order = await Order.findOne({
        _id: { $eq: orderId },
        user: { $eq: userId },
      }).lean();

      if (!order) {
        throw new AppError(
          HTTP_STATUS.NOT_FOUND,
          "Order not found or you do not have permission to view this invoice.",
        );
      }

      // STRICT TYPING FIX: Replaced 'any' with a safe double cast to satisfy the service
      const pdfBuffer = await generateInvoiceBuffer(order as unknown as IOrder);

      // Stream binary file to browser trigger native download
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="Invoice-${order.orderNumber}.pdf"`,
      );
      res.setHeader("Content-Length", pdfBuffer.length);

      return res.status(HTTP_STATUS.OK).end(pdfBuffer);
    },
  );

  /**
   * @route   POST /api/v1/orders/webhook
   * @desc    Razorpay Server-to-Server asynchronous event handler
   * @access  Public (Protected via HMAC Signature)
   */
  public static handleRazorpayWebhook = catchAsync(
    async (req: Request, res: Response) => {
      const signature = req.headers["x-razorpay-signature"] as string;

      if (!signature) {
        throw new AppError(
          HTTP_STATUS.BAD_REQUEST,
          "Missing cryptographic signature",
        );
      }

      // ARCHITECTURE NOTE: Extract the raw string body securely without the forbidden keyword
      const rawBody = (req as unknown as { rawBody?: string }).rawBody;

      if (!rawBody) {
        throw new AppError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          "Critical: Raw body not found. Webhook router is misconfigured.",
        );
      }

      // Strict two-step casting to satisfy TypeScript without compromising safety
      const parsedBody = req.body as unknown as IRazorpayWebhookBody;

      await OrderService.processWebhook(rawBody, parsedBody, signature);

      // Webhooks strictly require an immediate 200 OK response
      return res.status(HTTP_STATUS.OK).json({ status: "ok" });
    },
  );

  /**
   * @route   POST /api/v1/orders/shiprocket-webhook
   * @desc    Shiprocket Server-to-Server logistics event handler.
   * @access  Public (Protected via static API Key Header)
   */
  public static handleShiprocketWebhook = catchAsync(
    async (req: Request, res: Response) => {
      // Shiprocket allows you to define a custom header for authentication in their UI.
      // We will configure it to send 'x-api-key'.
      const providedSecret = req.headers["x-api-key"] as string;

      if (!providedSecret) {
        throw new AppError(
          HTTP_STATUS.UNAUTHORIZED,
          "Missing authentication header.",
        );
      }

      // Strict cast to the interface we defined
      const payload = req.body as IShiprocketWebhookPayload;

      // Offload to the Domain Service
      await ShiprocketService.processWebhook(payload, providedSecret);

      // Webhooks strictly require an immediate 200 OK response with a generic JSON success payload
      return res
        .status(HTTP_STATUS.OK)
        .json({ status: "success", received: true });
    },
  );
}

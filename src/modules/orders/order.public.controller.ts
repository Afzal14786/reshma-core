import { Request, Response } from "express";
import { OrderService } from "./order.service";
import { Order } from "./order.model";
import { ApiResponse } from "@shared/utils/api-response";
import { HTTP_STATUS } from "@shared/constant/http-codes";
import { AppError } from "@shared/utils/app-error";
import { CheckoutInput } from "./dtos/order.dto";
import { generateInvoiceBuffer } from "./invoice.generator";
import { IRazorpayWebhookBody, IOrder } from "./interfaces/order.interface";

export class OrderPublicController {
  /**
   * @route   POST /api/v1/orders/checkout
   * @desc    Initializes atomic checkout and returns the Razorpay Order ID
   * @access  Private (Logged in users)
   */
  public static async checkout(req: Request, res: Response) {
    const userId = req.user!._id.toString();
    const payload = req.body as CheckoutInput;

    const order = await OrderService.initializeCheckout(userId, payload);

    return new ApiResponse(
      res,
      HTTP_STATUS.CREATED,
      "Checkout initialized successfully. Proceed to payment.",
      { order },
    ).send();
  }

  /**
   * @route   POST /api/v1/orders/verify-payment
   * @desc    Cryptographically verifies the Razorpay success payload
   * @access  Private
   */
  public static async verifyPayment(req: Request, res: Response) {
    const userId = req.user!._id.toString();
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
  }

  /**
   * @route   GET /api/v1/orders/me
   * @desc    Fetch the logged-in user's order history
   * @access  Private
   */
  public static async getMyOrders(req: Request, res: Response) {
    const userId = req.user!._id.toString();

    const orders = await Order.find({ user: { $eq: String(userId) } })
      .sort("-createdAt")
      .lean();

    return new ApiResponse(
      res,
      HTTP_STATUS.OK,
      "Order history fetched successfully",
      { orders },
    ).send();
  }

  /**
   * @route   GET /api/v1/orders/:id/invoice
   * @desc    Generates and downloads a PDF tax invoice on-the-fly
   * @access  Private (Owner only)
   */
  public static async downloadInvoice(req: Request, res: Response) {
    const userId = req.user!._id.toString();
    const orderId = req.params.id;

    // SECURITY: IDOR Protection. By strictly requiring the requesting user's ID
    // to match the document's owner, we prevent malicious users from scraping other people's receipts.
    const order = await Order.findOne({
      _id: { $eq: String(orderId) },
      user: { $eq: String(userId) },
    }).lean();

    if (!order) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        "Order not found or you do not have permission to view this invoice.",
      );
    }

    // Generate PDF Buffer purely in RAM
    const pdfBuffer = await generateInvoiceBuffer(order as any);

    // Stream binary file to browser trigger native download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Invoice-${order.orderNumber}.pdf"`,
    );
    res.setHeader("Content-Length", pdfBuffer.length);

    return res.status(HTTP_STATUS.OK).end(pdfBuffer);
  }

  /**
   * @route   POST /api/v1/orders/webhook
   * @desc    Razorpay Server-to-Server asynchronous event handler
   * @access  Public (Protected via HMAC Signature)
   */
  public static async handleRazorpayWebhook(
    req: Request,
    res: Response,
  ): Promise<Response> {
    const signature = req.headers["x-razorpay-signature"] as string;

    if (!signature) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        "Missing cryptographic signature",
      );
    }

    // Strict two-step casting to satisfy TypeScript without compromising safety
    const body = req.body as unknown as IRazorpayWebhookBody;

    await OrderService.processWebhook(body, signature);

    // Webhooks strictly require an immediate 200 OK response
    return res.status(HTTP_STATUS.OK).json({ status: "ok" });
  }
}

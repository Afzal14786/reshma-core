import mongoose from "mongoose";
import axios, { AxiosError } from "axios";
import { IShiprocketWebhookPayload } from "./interfaces/order.interface";
import { User } from "@modules/users/user.model";
import { NotificationService } from "@modules/notifications/notification.service";
import env from "@config/env";
import logger from "@config/logger";
import { Order } from "./order.model";
import { shiprocketAuth } from "@config/shiprocket";
import { AppError } from "@shared/utils/app-error";
import { HTTP_STATUS } from "@shared/constant/http-codes";

/**
 * Strict typing for inbound physical dimensions.
 */
export interface IPhysicalDimensions {
  length: number;
  breadth: number;
  height: number;
  weight: number;
}

/**
 * Strict typing for outbound Database updates to prevent Mongoose document mutation errors.
 */
interface IOrderDispatchUpdate {
  orderStatus: "SHIPPED";
  trackingNumber: string;
  courierName: string;
  shiprocketOrderId: string;
  shiprocketShipmentId: string;
}

/**
 * Strict typing for Axios error interceptions.
 */
interface IShiprocketError {
  message?: string;
  error?: string;
}

/**
 * LOGISTICS ORCHESTRATOR (SERVICE LAYER)
 *
 * ARCHITECTURE NOTE:
 * This service manages the outbound physical fulfillment pipeline. It relies strictly
 * on the Singleton ShiprocketAuthManager to retrieve cached, rolling JWT tokens.
 */
export class ShiprocketService {
  /**
   * SECURITY UTILITY: CodeQL CWE-117 Neutralizer
   * @description Prevents CRLF Log Injection attacks by stripping control characters.
   */
  private static safeLog(message: string): string {
    return message.replace(/[\r\n]/g, "");
  }

  /**
   * @method getAuthHeaders
   * @description Fetches the active JWT and formats the authorization header.
   */
  private static async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await shiprocketAuth.getToken();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  /**
   * @method handleAxiosError
   * @description Safely extracts deep, nested error messages from Shiprocket's API
   * utilizing strict interfaces rather than the forbidden keyword.
   */
  private static handleAxiosError(error: unknown, context: string): never {
    if (axios.isAxiosError(error)) {
      const axiosErr = error as AxiosError<IShiprocketError>;
      const apiMessage =
        axiosErr.response?.data?.message ??
        axiosErr.response?.data?.error ??
        axiosErr.message;

      logger.error(
        this.safeLog(`[Shiprocket] ${context} Failed: ${apiMessage}`),
      );
      throw new AppError(
        HTTP_STATUS.BAD_GATEWAY,
        `Logistics Provider Error: ${apiMessage}`,
      );
    }

    if (error instanceof Error) {
      logger.error(
        this.safeLog(`[Shiprocket] ${context} Failed: ${error.message}`),
      );
    }

    throw new AppError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Logistics pipeline failure.",
    );
  }

  /**
   * @method dispatchOrder
   * @description The Master Orchestrator. Translates the MongoDB order into a physical shipment.
   * Executes the 3-step chain: Create Ad-Hoc Order -> Generate AWB -> Schedule Pickup.
   */
  public static async dispatchOrder(
    orderId: string,
    dimensions: IPhysicalDimensions,
  ): Promise<void> {
    const safeOrderId = String(orderId).replace(/[\r\n]/g, "");

    // Fetch & Verify Database State (Using $eq to prevent NoSQL Operator Injection)
    const order = await Order.findOne({ _id: { $eq: safeOrderId } }).lean();

    if (!order) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, "Order not found in database.");
    }

    // IDEMPOTENCY FIREWALL: Prevent duplicate shipments and double-billing
    if (order.trackingNumber || order.orderStatus === "SHIPPED") {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        "This order has already been dispatched.",
      );
    }

    // STATE FIREWALL: Ensure we don't physically ship unpaid items
    if (order.paymentMethod === "RAZORPAY" && order.paymentStatus !== "PAID") {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        "Cannot dispatch an unpaid Razorpay order.",
      );
    }

    logger.info(
      this.safeLog(
        `[Shiprocket] Initiating dispatch sequence for Order: ${order.orderNumber}`,
      ),
    );
    const headers = await this.getAuthHeaders();

    try {
      //
      // STEP 1: Create Ad-Hoc Order in Shiprocket
      //
      const orderPayload = {
        order_id: order.orderNumber,
        order_date: new Date(order.createdAt).toISOString().split("T")[0],
        pickup_location: "Primary",
        billing_customer_name: order.shippingAddress.fullName,
        billing_last_name: "",
        billing_address: order.shippingAddress.streetAddress,
        billing_city: order.shippingAddress.city,
        billing_pincode: order.shippingAddress.postalCode,
        billing_state: order.shippingAddress.state,
        billing_country: order.shippingAddress.country,
        billing_email: "customer@placeholder.com",
        billing_phone: order.shippingAddress.phone,
        shipping_is_billing: true,
        order_items: order.items.map((item) => ({
          name: item.name,
          sku: item.sku,
          units: item.quantity,
          selling_price: item.priceAtPurchase,
          discount: 0,
          tax: 0,
        })),
        payment_method: order.paymentMethod === "COD" ? "COD" : "Prepaid",
        sub_total: order.pricing.totalAmount,
        length: dimensions.length,
        breadth: dimensions.breadth,
        height: dimensions.height,
        weight: dimensions.weight,
      };

      const createResponse = await axios.post(
        `${env.SHIPROCKET_API_BASE_URL}/v1/external/orders/create/ad-hoc`,
        orderPayload,
        { headers },
      );

      const shiprocketOrderId = String(createResponse.data?.order_id ?? "");
      const shipmentId = String(createResponse.data?.shipment_id ?? "");

      if (!shiprocketOrderId || !shipmentId) {
        throw new Error("Shiprocket failed to return tracking identifiers.");
      }

      //
      // STEP 2: Generate AWB (Airway Bill)
      //
      const awbResponse = await axios.post(
        `${env.SHIPROCKET_API_BASE_URL}/v1/external/courier/assign/awb`,
        { shipment_id: shipmentId },
        { headers },
      );

      const awbCode = String(awbResponse.data?.response?.data?.awb_code ?? "");
      const courierName = String(
        awbResponse.data?.response?.data?.courier_name ?? "",
      );

      if (!awbCode) {
        throw new Error("Courier assignment failed. AWB Code missing.");
      }

      //
      // STEP 3: Request Physical Courier Pickup
      //
      await axios.post(
        `${env.SHIPROCKET_API_BASE_URL}/v1/external/courier/generate/pickup`,
        { shipment_id: [shipmentId] },
        { headers },
      );

      //
      // STEP 4: Synchronize Database State
      //
      // ARCHITECTURE NOTE: We only update MongoDB AFTER all network calls succeed.
      // If the network drops at Step 2, the order remains PENDING, allowing the Admin to safely retry.
      const updateData: IOrderDispatchUpdate = {
        orderStatus: "SHIPPED",
        trackingNumber: awbCode,
        courierName: courierName,
        shiprocketOrderId: shiprocketOrderId,
        shiprocketShipmentId: shipmentId,
      };

      await Order.updateOne(
        { _id: { $eq: safeOrderId } },
        { $set: updateData },
      );

      logger.info(
        this.safeLog(
          `[Shiprocket] Order ${order.orderNumber} successfully dispatched via ${courierName}. AWB: ${awbCode}`,
        ),
      );
    } catch (error: unknown) {
      this.handleAxiosError(
        error,
        `Dispatch Sequence for Order ${order.orderNumber}`,
      );
    }
  }

  /**
   * @method processWebhook
   * @description Server-to-Server asynchronous event handler for physical logistics updates.
   * Maps Shiprocket's tracking statuses to our internal database state machine.
   */
  public static async processWebhook(
    payload: IShiprocketWebhookPayload,
    providedSecret: string,
  ): Promise<void> {
    // Security Firewall: Verify the webhook actually came from Shiprocket
    // In your Shiprocket Dashboard, you will set the header key 'x-api-key' to match your ENV secret.
    if (providedSecret !== env.SHIPROCKET_WEBHOOK_SECRET) {
      logger.error(
        this.safeLog(
          `[Shiprocket Webhook] Critical: Invalid authentication secret provided.`,
        ),
      );
      throw new AppError(
        HTTP_STATUS.UNAUTHORIZED,
        "Invalid webhook authentication.",
      );
    }

    const safeAwb = String(payload.awb).replace(/[\r\n]/g, "");
    const currentStatus = String(payload.current_status).toUpperCase();

    // Fetch the Target Order
    const order = await Order.findOne({ trackingNumber: { $eq: safeAwb } });

    if (!order) {
      logger.warn(
        this.safeLog(
          `[Shiprocket Webhook] Received update for untracked AWB: ${safeAwb}`,
        ),
      );
      return;
    }

    // The Physical State Machine (Status Mapping)
    let newOrderStatus = order.orderStatus;
    let shouldTriggerDeliveryEmail = false;

    // Shiprocket has dozens of micro-statuses (e.g., "OUT FOR DELIVERY", "RTO INITIATED").
    // We map the terminal states to our high-level enums.
    switch (currentStatus) {
      case "DELIVERED":
        if (order.orderStatus !== "DELIVERED") {
          newOrderStatus = "DELIVERED";
          shouldTriggerDeliveryEmail = true;
        }
        break;
      case "CANCELED":
      case "CANCELLED":
        newOrderStatus = "CANCELLED";
        break;
      case "RTO DELIVERED":
      case "RTO ACKNOWLEDGED":
        newOrderStatus = "RETURNED";
        break;
      // We ignore intermediate states like "IN TRANSIT" as our DB only tracks macro-states
      default:
        break;
    }

    // Idempotency: If the status hasn't changed, exit early to save database writes
    if (newOrderStatus === order.orderStatus) {
      return;
    }

    // Update Database
    order.orderStatus = newOrderStatus;
    await order.save();

    logger.info(
      this.safeLog(
        `[Shiprocket Webhook] Order ${order.orderNumber} transitioned to ${newOrderStatus}.`,
      ),
    );

    // Asynchronous Notification Engine
    if (shouldTriggerDeliveryEmail) {
      try {
        const userDoc = await User.findOne({ _id: { $eq: String(order.user) } })
          .select("firstname email")
          .lean();

        if (userDoc) {
          await NotificationService.sendOrderDeliveredNotification(
            userDoc._id as mongoose.Types.ObjectId,
            userDoc.email,
            userDoc.firstname,
            order.orderNumber,
          );
        }
      } catch (notifyErr) {
        logger.error(
          this.safeLog(
            `[Shiprocket Webhook] Failed to dispatch delivery notification for ${order.orderNumber}`,
          ),
        );
      }
    }
  }
}

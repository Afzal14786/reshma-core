import { Document, Types } from "mongoose";

export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";
export type OrderStatus =
  | "PENDING"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURN_REQUESTED" // Added for Returns RMA module
  | "RETURNED"; // Added for Shiprocket RTO and Returns RMA module
export type PaymentMethod = "RAZORPAY" | "COD";

export interface IOrderShippingAddress {
  fullName: string;
  phone: string;
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

/**
 * ARCHITECTURE NOTE: Historical Snapshotting
 * We strictly copy product data into the order document rather than just referencing the Product ID.
 * This guarantees "Historical Immutability"—if an admin changes a product's price or deletes it
 * 6 months from now, the user's past receipts and our financial records remain 100% accurate.
 */
export interface IOrderItem {
  product: Types.ObjectId;
  name: string;
  sku: string;
  quantity: number;
  priceAtPurchase: number;
  selectedAttributes?: Record<string, string>;
  imageSnapshot: string;

  // mmutable Tax Snapshot (Line-Item Level Compliance)
  hsnCode: string;
  taxableValue: number; // The exact value the tax was calculated on (after proportional coupon discounts)
  gstRate: number; // e.g., 0, 3, 5, 12, 18
  cgst: number; // Central GST Amount
  sgst: number; // State GST Amount
  igst: number; // Integrated GST Amount
}

export interface IOrderPricing {
  subTotal: number;
  discountAmount: number;
  appliedCoupon: Types.ObjectId | null;

  // Granular Tax Totals
  totalTax: number; // The grand total of all tax combined
  totalCgst: number; // Sum of all CGST from items
  totalSgst: number; // Sum of all SGST from items
  totalIgst: number; // Sum of all IGST from items

  shippingCost: number; // The raw shipping service charge
  shippingTax: number; // The 18% GST extracted specifically from the shipping service

  totalAmount: number; // Final amount payable by the customer
}

export interface IOrder extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  orderNumber: string; // Human-readable ID (e.g., ORD-102938)

  items: IOrderItem[];
  shippingAddress: IOrderShippingAddress;
  pricing: IOrderPricing;

  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;

  // Logistics Tracking
  trackingNumber?: string;
  courierName?: string;

  // --- Shiprocket Identifiers ---
  shiprocketOrderId?: string;
  shiprocketShipmentId?: string;

  // Gateway Specific Identifiers (Nullable for COD)
  gatewayOrderId?: string; // e.g., Razorpay order_id
  gatewayPaymentId?: string; // e.g., Razorpay payment_id
  gatewaySignature?: string; // Cryptographic proof of payment

  invoiceUrl?: string; // Cloudinary PDF Link

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Strict Typings for Razorpay Webhook Events
 */
export interface IRazorpayWebhookBody {
  event: string;
  payload: {
    payment: {
      entity: {
        id: string;
        order_id: string;
      };
    };
  };
}

/**
 * Strict Typings for Shiprocket Webhook Events
 * Contains only the fields required for our physical state machine.
 */
export interface IShiprocketWebhookPayload {
  awb: string;
  courier_name: string;
  current_status: string;
  current_status_id: number;
  shipment_status: string;
  channel_order_id: string; // This maps to our internal orderNumber
}

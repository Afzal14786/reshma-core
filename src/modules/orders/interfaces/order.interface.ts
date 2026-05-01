import { Document, Types } from "mongoose";

export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";
export type OrderStatus =
  | "PENDING"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";
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
}

export interface IOrderPricing {
  subTotal: number;
  shippingCost: number;
  taxAmount: number;
  totalAmount: number;
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

  // Gateway Specific Identifiers (Nullable for COD)
  gatewayOrderId?: string; // e.g., Razorpay order_id
  gatewayPaymentId?: string; // e.g., Razorpay payment_id
  gatewaySignature?: string; // Cryptographic proof of payment

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
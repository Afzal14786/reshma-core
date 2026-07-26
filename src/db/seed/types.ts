import { Types } from "mongoose";

export interface ISeedAddress {
  street: string;
  city: string;
  state: string;
  pincode: string;
  label: "HOME" | "WORK" | "OTHER";
  isDefault: boolean;
}

export interface ISeedUser {
  firstname: string;
  lastname: string;
  email: string;
  password: string;
  phone?: string;
  avatar?: string;
  role: "USER" | "ADMIN";
  isEmailVerified: boolean;
  loyaltyPoints: number;
  addresses: ISeedAddress[];
}

export interface ISeedCategory {
  main: string;
  sub: string[];
}

export interface ISeedCoupon {
  code: string;
  discountType: "FLAT" | "PERCENTAGE";
  discountValue: number;
  minCartValue?: number;
  startDate: Date | string;
  expiryDate: Date | string;
  usageLimit?: number;
  usedCount: number;
  isActive: boolean;
}

// ---- Interfaces matching the Interaction schema ----
export interface IReviewInput {
  productId: Types.ObjectId;
  userId: Types.ObjectId;
  type: "REVIEW";
  rating: number;
  title?: string;
  content: string;
  images?: string[];
  isVerifiedPurchase: boolean;
  likes?: Types.ObjectId[];
  dislikes?: Types.ObjectId[];
  parentId: null;
}

export interface ICommentInput {
  productId: Types.ObjectId;
  userId: Types.ObjectId;
  type: "COMMENT";
  content: string;
  parentId: Types.ObjectId;
  isVerifiedPurchase: boolean;
  likes?: Types.ObjectId[];
  dislikes?: Types.ObjectId[];
  rating?: never;
  title?: never;
  images?: never;
}

// ---- Interfaces matching the Notification schema ----
export interface INotificationInput {
  recipientId: Types.ObjectId;
  type: "SYSTEM" | "ORDER" | "PROMOTION" | "SECURITY";
  title: string;
  message: string;
  isRead: boolean;
  link?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ---- Interfaces matching the Order schema ----
export interface IOrderItemInput {
  product: Types.ObjectId;
  name: string;
  sku: string;
  quantity: number;
  priceAtPurchase: number;
  selectedAttributes?: Record<string, any>;
  imageSnapshot: string;
  hsnCode: string;
  taxableValue: number;
  gstRate: number;
  cgst: number;
  sgst: number;
  igst: number;
}

export interface IShippingAddressInput {
  fullName: string;
  phone: string;
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
}

export interface IGeneratedOrder {
  user: Types.ObjectId;
  orderNumber: string;
  items: IOrderItemInput[];
  shippingAddress: IShippingAddressInput;
  paymentMethod: "RAZORPAY" | "COD";
  paymentStatus: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
  orderStatus:
    | "PENDING"
    | "PROCESSING"
    | "SHIPPED"
    | "DELIVERED"
    | "CANCELLED"
    | "RETURN_REQUESTED"
    | "RETURNED";
  trackingNumber?: string;
  courierName?: string;
  shiprocketOrderId?: string;
  shiprocketShipmentId?: string;
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  gatewaySignature?: string;
  invoiceUrl?: string;
  deliveredAt?: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  pricing: {
    subTotal: number;
    discountAmount: number;
    appliedCoupon?: Types.ObjectId;
    totalTax: number;
    totalCgst: number;
    totalSgst: number;
    totalIgst: number;
    shippingCost: number;
    shippingTax: number;
    totalAmount: number;
  };
}

export interface ICategoryMapping {
  main: string;
  sub: string[];
}

// ---- Updated to match the actual product schema ----
export interface IBaseProduct {
  name: string;
  sku: string;
  description: string;
  mainCategory: string;
  subCategory: string;
  material: string;
  colors: string[];
  sellingUnit: string; // must be one of: "Single Piece", "Meter", "Set", "Pair", "Dozen", "Pack"
  basePrice: number;
  discount: number;
  currentStock: number;
  weightGrams: number;
  isFragile: boolean;
  images: string[];
  tags: string[];
  itemType: string;
  hsnCode: string;
  taxProfile: string; // must be a valid TaxProfile enum value
  // Discriminator-specific fields will be added separately
}

// ---- Interfaces matching the Return schema ----
export interface IReturnItemInput {
  product: Types.ObjectId;
  quantity: number;
  reason: "DEFECTIVE" | "WRONG_ITEM" | "SIZE_ISSUE" | "NOT_LIKED";
  customerNote?: string;
}

export interface IGeneratedReturn {
  returnNumber: string;
  order: Types.ObjectId;
  user: Types.ObjectId;
  items: IReturnItemInput[];
  images?: string[];
  status: "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED";
  refundAmount?: number;
  adminNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ---- Interfaces matching the Ticket schema ----

import {
  TicketCategory,
  TicketPriority,
  TicketStatus,
  LinkedEntityType,
  MessageSenderRole,
} from "@modules/support/interfaces/support.interface";

export interface ITicketMessageInput {
  senderRole: MessageSenderRole;
  senderId: Types.ObjectId;
  message: string;
  attachments: string[];
  isRead: boolean;
}

export interface ILinkedEntityInput {
  entityType: LinkedEntityType;
  entityId: Types.ObjectId;
}

export interface ITicketInput {
  user: Types.ObjectId;
  subject: string;
  category: TicketCategory;
  priority?: TicketPriority;
  status?: TicketStatus;
  assignedAdmin?: Types.ObjectId;
  linkedEntity?: ILinkedEntityInput;
  messages: ITicketMessageInput[];
}

// ---- Interfaces matching the Wishlist schema ----
export interface IWishlistItemInput {
  product: Types.ObjectId;
  addedAt: Date;
}

export interface IWishlistInput {
  user: Types.ObjectId;
  items: IWishlistItemInput[];
}

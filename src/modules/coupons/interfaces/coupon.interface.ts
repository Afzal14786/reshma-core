import { Document } from "mongoose";

export enum DiscountType {
  PERCENTAGE = "PERCENTAGE",
  FLAT = "FLAT",
}

export enum PaymentRestriction {
  ANY = "ANY",
  PREPAID = "PREPAID",
  COD = "COD",
}

export interface ICoupon extends Document {
  code: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscountAmount?: number; // Required if type is PERCENTAGE
  minCartValue: number;
  startDate: Date;
  expiryDate: Date;
  usageLimit: number;
  usedCount: number;
  isActive: boolean;
  isFirstOrderOnly: boolean;
  paymentMethodRestriction: PaymentRestriction;
  createdAt: Date;
  updatedAt: Date;
}

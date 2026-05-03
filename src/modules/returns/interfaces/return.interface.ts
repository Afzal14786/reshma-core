import { Document, Types } from 'mongoose';

/**
 * Strict State Machine for Returns. 
 * An order return must linearly transition through these states.
 */
export enum ReturnStatus {
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  REFUNDED = 'REFUNDED',
}

/**
 * Pre-defined return reasons to power Admin Analytics (Phase 10)
 * rather than allowing free-text strings that cannot be aggregated.
 */
export enum ReturnReason {
  DEFECTIVE = 'DEFECTIVE',
  WRONG_ITEM = 'WRONG_ITEM',
  SIZE_ISSUE = 'SIZE_ISSUE',
  NOT_NEEDED = 'NOT_NEEDED',
}

export interface IReturnItem {
  product: Types.ObjectId;
  quantity: number;
  reason: ReturnReason;
  customerNote?: string;
}

export interface IReturn extends Document {
  user: Types.ObjectId;
  order: Types.ObjectId;
  items: IReturnItem[];
  status: ReturnStatus;
  proofOfDamageImages: string[]; // Strictly populated via Cloudinary middleware
  refundAmountEstimate: number;  // Financial Boundary: Computed strictly by backend, never trusted from frontend
  adminRejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}
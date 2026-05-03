import { Schema, model } from 'mongoose';
import { IReturn, ReturnStatus, ReturnReason } from './interfaces/return.interface';

/**
 * Sub-document schema for the specific items being returned.
 * _id is set to false to prevent MongoDB from generating unnecessary ObjectIds
 * inside the array, optimizing storage and read performance.
 */
const ReturnItemSchema = new Schema(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product', // References the Polymorphic Product schema
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
    },
    reason: {
      type: String,
      enum: Object.values(ReturnReason),
      required: true,
    },
    customerNote: {
      type: String,
      trim: true,
      maxlength: [500, 'Note cannot exceed 500 characters'],
    },
  },
  { _id: false }
);

const ReturnSchema = new Schema<IReturn>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true, 
    },
    order: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      unique: true, // SECURITY: Physical database lock preventing double-refund fraud
    },
    items: [ReturnItemSchema],
    status: {
      type: String,
      enum: Object.values(ReturnStatus),
      default: ReturnStatus.PENDING_APPROVAL,
    },
    proofOfDamageImages: {
      type: [String],
      default: [],
    },
    refundAmountEstimate: {
      type: Number,
      required: true,
      min: [0, 'Refund amount cannot be negative'], // Financial integrity constraint
    },
    adminRejectionReason: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export const ReturnModel = model<IReturn>('Return', ReturnSchema);
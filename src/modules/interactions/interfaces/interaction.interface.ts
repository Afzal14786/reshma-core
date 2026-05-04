import { Document, Types } from "mongoose";

/**
 * Defines the polymorphic nature of the Interaction model.
 * - REVIEW: A top-level assessment of a product. Impacts mathematical aggregates.
 * - COMMENT: A threaded reply to a Review or another Comment. Does NOT impact aggregates.
 */
export enum InteractionType {
  REVIEW = "REVIEW",
  COMMENT = "COMMENT",
}

/**
 * @interface IInteraction
 * @description Core contract for the Interactions collection.
 * Represents either a product review or a nested comment thread.
 *
 * SECURITY NOTE (CodeQL): All object references are strictly cast to `Types.ObjectId`
 * to prevent NoSQL Injection vulnerabilities where attackers pass malicious query objects (e.g., {$gt: ""}).
 */
export interface IInteraction extends Document {
  /** Reference to the base product. Indexed for O(log N) retrieval. */
  productId: Types.ObjectId;

  /** Reference to the author. */
  userId: Types.ObjectId;

  /** Dictates validation rules. Reviews require ratings; Comments forbid them. */
  type: InteractionType;

  /**
   * The star rating (1-5).
   * @optional Only present if type === 'REVIEW'.
   */
  rating?: number;

  /** Short headline for the review. */
  title?: string;

  /** The main body of the review or comment. */
  content: string;

  /** Array of Cloudinary secure URLs. */
  images: string[];

  /**
   * Array of User IDs who found this interaction helpful.
   * ARCHITECTURE NOTE: For hyper-scale (100k+ likes), this should be migrated to a
   * separate Edge collection to prevent breaching the 16MB BSON document limit.
   */
  likes: Types.ObjectId[];

  /** Array of User IDs who found this interaction unhelpful. */
  dislikes: Types.ObjectId[];

  /**
   * Adjacency List pattern for infinite threading.
   * @type {Types.ObjectId | null} - Null if top-level review; ObjectId if it is a reply.
   */
  parentId: Types.ObjectId | null;

  /**
   * Trust Layer indicator.
   * True ONLY if the Service layer cryptographically verifies a DELIVERED order history.
   */
  isVerifiedPurchase: boolean;

  createdAt: Date;
  updatedAt: Date;
}

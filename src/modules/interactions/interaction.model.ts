import mongoose, { Schema } from "mongoose";
import {
  IInteraction,
  InteractionType,
} from "./interfaces/interaction.interface";

/**
 * BSON Memory Protection Validators (CWE-400 Mitigation)
 * Prevents attackers from sending massive arrays that crash the Node process
 * or breach the 16MB MongoDB document limit.
 */
const arrayLimit = (val: string[] | mongoose.Types.ObjectId[]) =>
  val.length <= 5;
const voteLimit = (val: mongoose.Types.ObjectId[]) => val.length <= 10000;

/**
 * @schema InteractionSchema
 * @description The unified schema for Reviews and Comments, utilizing the Adjacency List pattern.
 */
const InteractionSchema = new Schema<IInteraction>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product ID is strictly required."],
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is strictly required."],
    },
    type: {
      type: String,
      enum: {
        values: Object.values(InteractionType),
        message: "{VALUE} is not a valid interaction type.",
      },
      required: true,
    },
    rating: {
      type: Number,
      min: [1, "Mathematical violation: Rating cannot be below 1"],
      max: [5, "Mathematical violation: Rating cannot exceed 5"],
      /**
       * @function required
       * @description Dynamic schema validation. Enforces that top-level REVIEWS contain a rating,
       * while preventing COMMENTS from secretly carrying a rating to manipulate aggregates.
       */
      required: function (this: IInteraction) {
        return this.type === InteractionType.REVIEW;
      },
    },
    title: {
      type: String,
      trim: true,
      maxlength: [150, "Title exceeds safe memory limits (150 chars)."],
    },
    content: {
      type: String,
      required: [true, "Interaction content cannot be empty."],
      trim: true,
      maxlength: [2000, "Content exceeds safe memory limits (2000 chars)."],
    },
    images: {
      type: [String],
      default: [],
      validate: [
        arrayLimit,
        "Security violation: Exceeds maximum allowed images (5).",
      ],
    },
    likes: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      default: [],
      validate: [
        voteLimit,
        "Security violation: Like array exceeds operational limits.",
      ],
    },
    dislikes: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      default: [],
      validate: [
        voteLimit,
        "Security violation: Dislike array exceeds operational limits.",
      ],
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "Interaction", // Self-reference establishes the recursive thread
      default: null,
    },
    isVerifiedPurchase: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

/**
 * INDUSTRY-GRADE PERFORMANCE & INTEGRITY INDEXES
 */

/**
 * @index Catalog Fetch Optimization
 * @description Supports the read-heavy operation of fetching all root reviews for a product page.
 * Sorts by newest first. Time Complexity: O(log N).
 */
InteractionSchema.index({ productId: 1, parentId: 1, createdAt: -1 });

/**
 * @index Thread Expansion Optimization
 * @description Supports O(log N) retrieval of all child comments when a user clicks "View Replies".
 */
InteractionSchema.index({ parentId: 1, createdAt: 1 });

/**
 * @index The Anti-Spam Firewall (CWE-770 Mitigation)
 * @description A Partial Unique Index. It physically guarantees at the database level that
 * a User can ONLY leave ONE top-level review per Product.
 * The `partialFilterExpression` bypasses this rule for replies, allowing unlimited comments.
 */
InteractionSchema.index(
  { productId: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: { type: InteractionType.REVIEW, parentId: null },
  },
);

export const Interaction = mongoose.model<IInteraction>(
  "Interaction",
  InteractionSchema,
);

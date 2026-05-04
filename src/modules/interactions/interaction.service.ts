import { Types } from "mongoose";
import { Interaction } from "./interaction.model";
import {
  InteractionType,
  IInteraction,
} from "./interfaces/interaction.interface";
import { Product } from "../products/models/base-product.model";
import { Order } from "../orders/order.model";
import { AppError } from "@shared/utils/app-error";
import { HTTP_STATUS } from "@shared/constant/http-codes";
import logger from "@config/logger";
import { TCreateInteractionBody } from "./dtos/create-interaction.dto";

export class InteractionService {
  /**
   * CORE WRITE OPERATION (Review / Comment)
   * @description Handles the creation of interactions. Performs a cross-module
   * trust check against the Orders collection to grant the "Verified Purchase" status.
   */
  public static async createInteraction(
    userId: string,
    payload: TCreateInteractionBody,
  ): Promise<IInteraction> {
    const userObjId = new Types.ObjectId(userId);
    const productObjId = new Types.ObjectId(payload.productId);

    // Rule 1: Enforce Thread Integrity for Comments
    if (payload.type === InteractionType.COMMENT && payload.parentId) {
      const parentObjId = new Types.ObjectId(payload.parentId);
      const parentExists = await Interaction.exists({ _id: parentObjId });

      if (!parentExists) {
        throw new AppError(
          HTTP_STATUS.NOT_FOUND,
          "The review or comment you are replying to no longer exists.",
        );
      }
    }

    // Rule 2: Anti-Spam Firewall for Reviews
    if (payload.type === InteractionType.REVIEW) {
      const existingReview = await Interaction.exists({
        productId: productObjId,
        userId: userObjId,
        type: InteractionType.REVIEW,
        parentId: null,
      });

      if (existingReview) {
        throw new AppError(
          HTTP_STATUS.CONFLICT,
          "You have already submitted a review for this product.",
        );
      }
    }

    // Rule 3: The Trust Layer (Verified Purchase Check)
    let isVerifiedPurchase = false;
    if (payload.type === InteractionType.REVIEW) {
      const verifiedOrder = await Order.exists({
        user: userObjId,
        "items.product": productObjId,
        orderStatus: "DELIVERED",
      });

      if (verifiedOrder) {
        isVerifiedPurchase = true;
      }
    }

    // Strict Persistence Mapping
    const interactionData: Partial<IInteraction> = {
      productId: productObjId,
      userId: userObjId,
      type: payload.type as InteractionType,
      content: payload.content,
      isVerifiedPurchase,
      parentId: payload.parentId ? new Types.ObjectId(payload.parentId) : null,
    };

    if (payload.rating !== undefined) interactionData.rating = payload.rating;
    if (payload.title !== undefined) interactionData.title = payload.title;
    if (payload.images !== undefined) interactionData.images = payload.images;

    const newInteraction = await Interaction.create(interactionData);

    // Fire Async Aggregation safely via setImmediate to prevent floating promises
    if (payload.type === InteractionType.REVIEW) {
      setImmediate(() => {
        InteractionService.syncProductRatings(productObjId).catch((err) => {
          if (err instanceof Error) {
            // SECURITY (CodeQL CWE-117): Sanitize ID and strip CRLF characters from error message
            const safeProductId = productObjId.toHexString();
            const safeErrorMsg = err.message.replace(/\r?\n|\r/g, " ");
            logger.error(
              `[InteractionService] Failed to sync ratings for Product ${safeProductId}: ${safeErrorMsg}`,
            );
          }
        });
      });
    }

    return newInteraction;
  }

  /**
   * MONGODB AGGREGATION ENGINE (The Math Layer)
   */
  public static async syncProductRatings(
    productId: Types.ObjectId,
  ): Promise<void> {
    const stats = await Interaction.aggregate([
      {
        $match: {
          productId: productId,
          type: InteractionType.REVIEW,
          parentId: null,
        },
      },
      {
        $group: {
          _id: "$productId",
          totalReviews: { $sum: 1 },
          averageRating: { $avg: "$rating" },
          count1: { $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] } },
          count2: { $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] } },
          count3: { $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] } },
          count4: { $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] } },
          count5: { $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] } },
        },
      },
    ]);

    if (stats.length > 0) {
      const data = stats[0];
      await Product.findByIdAndUpdate(productId, {
        $set: {
          "ratingsMetadata.averageRating": data.averageRating,
          "ratingsMetadata.totalReviews": data.totalReviews,
          "ratingsMetadata.ratingDistribution.1": data.count1,
          "ratingsMetadata.ratingDistribution.2": data.count2,
          "ratingsMetadata.ratingDistribution.3": data.count3,
          "ratingsMetadata.ratingDistribution.4": data.count4,
          "ratingsMetadata.ratingDistribution.5": data.count5,
        },
      });

      // SECURITY (CodeQL CWE-117): Sanitize ID before logging
      const safeProductId = productId.toHexString();
      logger.info(
        `[InteractionService] Successfully synced ratings for Product ${safeProductId}`,
      );
    } else {
      await Product.findByIdAndUpdate(productId, {
        $set: {
          "ratingsMetadata.averageRating": 0,
          "ratingsMetadata.totalReviews": 0,
          "ratingsMetadata.ratingDistribution.1": 0,
          "ratingsMetadata.ratingDistribution.2": 0,
          "ratingsMetadata.ratingDistribution.3": 0,
          "ratingsMetadata.ratingDistribution.4": 0,
          "ratingsMetadata.ratingDistribution.5": 0,
        },
      });
    }
  }

  /**
   * THE CONCURRENCY-SAFE VOTING SYSTEM
   */
  public static async voteOnInteraction(
    interactionId: string,
    userId: string,
    action: "LIKE" | "DISLIKE",
  ): Promise<void> {
    const interObjId = new Types.ObjectId(interactionId);
    const userObjId = new Types.ObjectId(userId);

    const updateQuery =
      action === "LIKE"
        ? { $addToSet: { likes: userObjId }, $pull: { dislikes: userObjId } }
        : { $addToSet: { dislikes: userObjId }, $pull: { likes: userObjId } };

    const result = await Interaction.findByIdAndUpdate(interObjId, updateQuery);

    if (!result) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        "The interaction you are trying to vote on does not exist.",
      );
    }
  }
}

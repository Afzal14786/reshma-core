import mongoose, { Types } from "mongoose";
import { Wishlist } from "./wishlist.model";
import { Product } from "../products/models/base-product.model";
import { CartService } from "../cart/cart.service";
import { AppError } from "@shared/utils/app-error";
import { HTTP_STATUS } from "@shared/constant/http-codes";
import logger from "@config/logger";
import { AddWishlistItemInput, MoveToCartInput } from "./dtos/wishlist.dto";
import { IWishlistItem } from "./interfaces/wishlist.interface";

/**
 * Strict Typings for Population
 * Prevents the use of the forbidden 'any' keyword during runtime evaluation.
 */
interface IPopulatedProduct {
  _id: Types.ObjectId;
  name: string;
  sku: string;
  basePrice: number;
  discount: number;
  currentStock: number;
  images: { url: string; altText?: string }[];
  isActive: boolean;
  itemType: string;
}

interface IPopulatedWishlistItem extends Omit<IWishlistItem, "product"> {
  product: IPopulatedProduct | null;
}

/**
 * WISHLIST DOMAIN ENGINE (SERVICE LAYER)
 * ARCHITECTURE NOTE:
 * This service focuses heavily on read-optimization and data hygiene.
 * It utilizes Lazy Initialization to prevent DB bloat and implements
 * Self-Healing mechanisms to purge deactivated products dynamically.
 */
export class WishlistService {
  /**
   * SECURITY UTILITY: CodeQL CWE-117 Neutralizer
   * @description Cleans strings of control characters before logging to prevent Log Injection.
   */
  private static safeLog(message: string): string {
    return message.replace(/[\r\n]/g, "");
  }

  /**
   * @method getWishlist
   * @description Retrieves the wishlist with dynamically populated, live product data.
   * Concurrency-safe self-healing mechanism purges ghost items without overwriting live data.
   */
  public static async getWishlist(userId: string) {
    const safeUserId = String(userId).replace(/[\r\n]/g, "");

    const wishlist = await Wishlist.findOne({
      user: { $eq: safeUserId },
    }).populate({
      path: "items.product",
      select:
        "name sku basePrice discount currentStock images isActive itemType",
    });

    if (!wishlist) {
      return { items: [] };
    }

    const deadProductIds: string[] = [];
    const validItems: IWishlistItem[] = [];

    // Evaluate populated data for data hygiene
    for (const item of wishlist.items) {
      const popItem = item as unknown as IPopulatedWishlistItem;

      // Case 1: Product reference points at nothing (physically deleted).
      // Populate nullifies the field, so we cannot recover the original
      // ObjectId from the document here. Skip it from the response — the
      // stale reference will be cleaned up on the next migration.
      if (!popItem.product) {
        continue;
      }

      // Case 2: Product exists but has been deactivated (soft-deleted).
      // Populate gave us the full Product document. Use its `_id` — NOT
      // the document itself, which is what `.toString()` would produce.
      if (popItem.product.isActive === false) {
        deadProductIds.push(String(popItem.product._id));
        continue;
      }

      validItems.push(item as IWishlistItem);
    }

    // ATOMIC SELF-HEALING
    // overwrite items the user may have added in a parallel browser tab during this execution.
    if (deadProductIds.length > 0) {
      await Wishlist.updateOne(
        { user: { $eq: safeUserId } },
        { $pull: { items: { product: { $in: deadProductIds } } } },
      );
      logger.info(
        this.safeLog(
          `[WishlistService] Self-healed ghost items for user ${safeUserId}`,
        ),
      );
    }

    return { items: validItems };
  }

  /**
   * @method addItem
   * @description Safely appends an item using Atomic $push and gracefully handles
   * race-condition document initialization.
   */
  public static async addItem(userId: string, payload: AddWishlistItemInput) {
    const safeUserId = String(userId).replace(/[\r\n]/g, "");
    const safeProductId = String(payload.productId).replace(/[\r\n]/g, "");

    const product = await Product.findOne({
      _id: { $eq: safeProductId },
      isActive: { $eq: true },
    }).lean();

    if (!product) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        "Product not found or currently inactive.",
      );
    }

    const existingWishlist = await Wishlist.findOne({
      user: { $eq: safeUserId },
    }).lean();

    if (existingWishlist) {
      // Hard capacity firewall
      if (existingWishlist.items.length >= 100) {
        throw new AppError(
          HTTP_STATUS.BAD_REQUEST,
          "Wishlist capacity limit (100) reached. Please remove items before adding more.",
        );
      }

      // Idempotency: Return early if already present
      const exists = existingWishlist.items.some(
        (i) => i.product.toString() === safeProductId,
      );
      if (exists) return this.getWishlist(safeUserId);
    } else {
      // LAZY INITIALIZATION COLLISION CATCHER
      // If two requests try to initialize the wishlist at the exact same millisecond,
      // MongoDB's unique index on `user` will throw an E11000 duplicate key error.
      try {
        await Wishlist.create([{ user: safeUserId, items: [] }]);
      } catch (err: unknown) {
        const mongoError = err as { code?: number };
        if (mongoError.code !== 11000) throw err;
      }
    }

    // ATOMIC ADDITION
    // This mathematically guarantees no duplicate items and no lost updates.
    await Wishlist.updateOne(
      {
        user: { $eq: safeUserId },
        "items.product": { $ne: safeProductId },
      },
      {
        $push: { items: { product: new Types.ObjectId(safeProductId) } },
      },
    );

    return this.getWishlist(safeUserId);
  }

  /**
   * @method removeItem
   * @description Atomically drops a specific product from the wishlist.
   */
  public static async removeItem(userId: string, productId: string) {
    const safeUserId = String(userId).replace(/[\r\n]/g, "");
    const safeProductId = String(productId).replace(/[\r\n]/g, "");

    const wishlist = await Wishlist.findOneAndUpdate(
      { user: { $eq: safeUserId } },
      { $pull: { items: { product: safeProductId } } },
      { new: true },
    );

    if (!wishlist) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, "Wishlist not found.");
    }

    return this.getWishlist(safeUserId);
  }

  /**
   * @method clearWishlist
   * @description Completely empties the array.
   */
  public static async clearWishlist(userId: string) {
    const safeUserId = String(userId).replace(/[\r\n]/g, "");

    const wishlist = await Wishlist.findOneAndUpdate(
      { user: { $eq: safeUserId } },
      { $set: { items: [] } },
      { new: true },
    );

    if (!wishlist) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, "Wishlist not found.");
    }
  }

  /**
   * @method moveToCart
   * @description Cross-module transfer. Leverages the Cart Service's ACID transaction,
   * then surgically removes the item from the wishlist using atomic operators.
   */
  public static async moveToCart(
    userId: string,
    productId: string,
    payload: MoveToCartInput,
  ) {
    const safeUserId = String(userId).replace(/[\r\n]/g, "");
    const safeProductId = String(productId).replace(/[\r\n]/g, "");

    const wishlist = await Wishlist.findOne({
      user: { $eq: safeUserId },
    }).lean();
    if (!wishlist) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, "Wishlist not found.");
    }

    const itemExists = wishlist.items.some(
      (i) => i.product.toString() === safeProductId,
    );
    if (!itemExists) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        "This item is no longer in your wishlist.",
      );
    }

    // STEP 1: Hand execution to CartService
    // CartService manages its own MongoDB session to evaluate stock and apply coupons.
    // If it fails (e.g., out of stock), it throws an AppError, halting execution here,
    // which safely leaves the item in the user's wishlist.
    await CartService.addItem(safeUserId, {
      productId: safeProductId,
      quantity: payload.quantity,
      selectedAttributes: payload.selectedAttributes,
    });

    // STEP 2: Atomic Cleanup
    // We use $pull instead of filtering the array to protect against race conditions.
    await Wishlist.updateOne(
      { user: { $eq: safeUserId } },
      { $pull: { items: { product: safeProductId } } },
    );

    logger.info(
      this.safeLog(
        `[WishlistService] User ${safeUserId} moved product ${safeProductId} to cart.`,
      ),
    );

    return this.getWishlist(safeUserId);
  }

  /**
   * DPDP / GDPR Legal Engine: The State Wiper
   * * ARCHITECTURE NOTE:
   * Permanently deletes the user's wishlist from the database during account deletion.
   * This ensures we do not hold "ghost data" that bloats our indexes.
   */
  public static async deleteUserWishlist(
    userId: string,
    session: mongoose.ClientSession,
  ) {
    const safeUserId = String(userId).replace(/[\r\n]/g, "");

    const result = await Wishlist.deleteOne(
      { user: { $eq: safeUserId } },
      { session },
    );

    logger.info(
      this.safeLog(
        `[Privacy Engine] Erased wishlist for deleted user ${safeUserId}`,
      ),
    );

    return result;
  }
}

import mongoose, { Types, ClientSession } from "mongoose";
import { Cart } from "./cart.model";
import { Product } from "../products/models/base-product.model";
import { AppError } from "@shared/utils/app-error";
import { HTTP_STATUS } from "@shared/constant/http-codes";
import { CouponService } from "@modules/coupons/coupon.service";
import { CouponModel } from "@modules/coupons/coupon.model";
import { TaxEngine, TaxProfile } from "@modules/orders/tax.utils";
import logger from "@config/logger";
import {
  AddItemToCartInput,
  UpdateCartItemInput,
  MergeCartInput,
} from "./dtos/cart.dto";
import { AttributeValue, ICartItem, ICart } from "./interfaces/cart.interface";

/**
 * @interface ICartTotals
 * @description The dynamically calculated financial and shipping metrics for the cart.
 */
interface ICartTotals {
  subTotal: number;
  totalWeightGrams: number;
  hasFragileItems: boolean;
  totalItems: number;
  // Legal Tax & Financial Fields
  totalTax: number;
  estimatedShipping: number;
  shippingTax: number;
  grandTotal: number;
}

/**
 * @interface IPopulatedProduct
 * @description Strictly types the product object after it is populated by Mongoose.
 * Prevents the use of the forbidden keyword during math calculations.
 */
interface IPopulatedProduct {
  _id: Types.ObjectId;
  name: string;
  sku: string;
  basePrice: number;
  discount: number;
  currentStock: number;
  weightGrams: number;
  isFragile: boolean;
  isActive: boolean;
  images: { url: string; altText?: string }[];
  itemType: string;
  // Legal Tax Fields
  hsnCode: string;
  taxProfile: TaxProfile;
}

/**
 * @interface IPopulatedCartItem
 * @description Intersects ICartItem with the populated product payload
 */
type IPopulatedCartItem = Omit<ICartItem, "product"> & {
  product: IPopulatedProduct | null;
};

/**
 *
 * CART SERVICE (CORE DOMAIN LOGIC)
 *
 * ARCHITECTURE NOTE:
 * This service utilizes MongoDB Sessions/Transactions for all write operations.
 * This ensures that if a coupon recalculation fails, the entire cart update
 * is rolled back, preventing financial inconsistency.
 */
export class CartService {
  /**
   * SECURITY UTILITY: CodeQL CWE-117 Neutralizer
   * @description Cleans strings of control characters before logging.
   */
  private static safeLog(message: string): string {
    return message.replace(/[\r\n]/g, "");
  }

  /**
   * @method generateItemSignature
   * @private
   */
  private static generateItemSignature(
    productId: string,
    attributes?: Record<string, AttributeValue>,
  ): string {
    if (!attributes || Object.keys(attributes).length === 0) return productId;
    const sortedKeys = Object.keys(attributes).sort();
    const attributeString = sortedKeys
      .map((key) => `${key}:${attributes[key]}`)
      .join("|");
    return `${productId}|${attributeString}`;
  }

  /**
   * @method reconstructAttributes
   * @private
   */
  private static reconstructAttributes(
    attributes?: Record<string, AttributeValue>,
  ): Record<string, AttributeValue> | undefined {
    if (!attributes) return undefined;

    // PROTOTYPE POLLUTION GUARD
    // Initialize an object with absolutely no prototype chain to prevent CWE-1321
    const safeAttributes: Record<string, AttributeValue> = Object.create(null);

    for (const [key, value] of Object.entries(attributes)) {
      // Explicitly drop dangerous prototype traversal keys
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        continue;
      }
      safeAttributes[key] = value;
    }

    return safeAttributes;
  }

  /**
   * @method getCart
   * @description Self-Healing retrieval logic. Purges inactive products.
   */
  /**
   * @method getCart
   * @description Self-Healing retrieval logic executing a two-pass tax calculation.
   */
  public static async getCart(userId: string) {
    const safeUserId = String(userId).replace(/[\r\n]/g, "");

    let cart = await Cart.findOne({ user: { $eq: safeUserId } }).populate({
      path: "items.product",
      // Enforced population of taxProfile to run the mathematical engine
      select:
        "name sku basePrice discount currentStock weightGrams isFragile isActive images itemType hsnCode taxProfile",
    });

    if (!cart) {
      cart = await Cart.create({ user: safeUserId, items: [] });
      return {
        items: [],
        totals: {
          subTotal: 0,
          totalWeightGrams: 0,
          hasFragileItems: false,
          totalItems: 0,
          totalTax: 0,
          estimatedShipping: 0,
          shippingTax: 0,
          grandTotal: 0,
        },
      };
    }

    const validItems: ICartItem[] = [];
    const totals: ICartTotals = {
      subTotal: 0,
      totalWeightGrams: 0,
      hasFragileItems: false,
      totalItems: 0,
      totalTax: 0,
      estimatedShipping: 0,
      shippingTax: 0,
      grandTotal: 0,
    };

    let needsHeal = false;

    // PASS 1: Aggregate Raw Totals
    for (const item of cart.items) {
      const product = item.product as unknown as IPopulatedProduct | null;

      if (!product || product.isActive === false) {
        needsHeal = true;
        continue;
      }

      const activePrice =
        product.basePrice - product.basePrice * (product.discount / 100);
      totals.subTotal += activePrice * item.quantity;
      totals.totalWeightGrams += product.weightGrams * item.quantity;
      if (product.isFragile) totals.hasFragileItems = true;
      totals.totalItems += item.quantity;

      validItems.push(item as unknown as ICartItem);
    }

    if (needsHeal) {
      cart.items = validItems as unknown as typeof cart.items;
    }

    // UI Deadlock Prevention
    // If the live subTotal changed (e.g., Admin altered a price), we must dynamically
    // re-evaluate the cached coupon. Otherwise, the user gets stuck in an infinite loop
    // where Checkout rejects the cart, but refreshing the page keeps the invalid coupon.
    if (cart.appliedCoupon) {
      const originalDiscount = cart.discountAmount;
      await this.recalculateCartTotals(cart, safeUserId);

      if (cart.discountAmount !== originalDiscount || needsHeal) {
        await cart.save();
      }
    } else if (needsHeal) {
      await cart.save();
    }

    // PASS 2: Proportional Discounting & Taxation

    const globalDiscount = cart.discountAmount || 0;
    const itemsWithTaxBreakdown = [];

    for (const item of validItems) {
      const product = item.product as unknown as IPopulatedProduct;
      const activePrice =
        product.basePrice - product.basePrice * (product.discount / 100);
      const itemPreCouponTotal = activePrice * item.quantity;

      // Mathematically determine this item's weight in the total cart value
      const itemWeightInCart =
        totals.subTotal > 0 ? itemPreCouponTotal / totals.subTotal : 0;

      // Proportionally apply the coupon discount to this specific line item
      const itemCouponDiscount = globalDiscount * itemWeightInCart;
      const itemPostCouponTotal = itemPreCouponTotal - itemCouponDiscount;
      const discountedPricePerUnit = itemPostCouponTotal / item.quantity;

      // Process through the Legal Tax Engine
      const taxResult = TaxEngine.calculateLineItemTax(
        product.taxProfile,
        discountedPricePerUnit,
        item.quantity,
      );

      totals.totalTax += taxResult.totalTax;

      // Attach tax calculations to the outgoing response for UI transparency
      itemsWithTaxBreakdown.push({
        ...item,
        financials: {
          preCouponTotal: itemPreCouponTotal,
          postCouponTotal: itemPostCouponTotal,
          taxableValue: taxResult.taxableValue,
          gstRate: taxResult.gstRate,
          totalTax: taxResult.totalTax,
        },
      });
    }

    // Fix Float Imprecision from summing
    totals.totalTax = Number(totals.totalTax.toFixed(2));

    // PASS 3: Shipping & Final Assembly
    // Rule: Free shipping over ₹2000
    // If a coupon makes the cart free, totalAfterDiscount will correctly remain 0 instead of reverting to subTotal.
    const totalAfterDiscount =
      cart.appliedCoupon != null ? cart.totalAfterDiscount : totals.subTotal;
    totals.estimatedShipping = totalAfterDiscount > 2000 ? 0 : 100;

    // Extract the 18% service tax from the shipping charge
    const shippingTaxResult = TaxEngine.calculateShippingTax(
      totals.estimatedShipping,
    );
    totals.shippingTax = shippingTaxResult.totalTax;

    totals.grandTotal = Number(
      (totalAfterDiscount + totals.totalTax + totals.estimatedShipping).toFixed(
        2,
      ),
    );

    return {
      items: itemsWithTaxBreakdown,
      totals,
      appliedCoupon: cart.appliedCoupon,
      discountAmount: cart.discountAmount,
      totalAfterDiscount: totalAfterDiscount,
    };
  }

  /**
   * @method addItem
   * @description Atomic operation ensuring stock availability and coupon validity.
   */
  public static async addItem(userId: string, payload: AddItemToCartInput) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { productId, quantity, selectedAttributes } = payload;
      const safeUserId = String(userId).replace(/[\r\n]/g, "");

      const product = await Product.findOne({ _id: { $eq: String(productId) } })
        .session(session)
        .lean();
      if (!product || !product.isActive)
        throw new AppError(HTTP_STATUS.NOT_FOUND, "Product unavailable.");
      if (product.currentStock < quantity)
        throw new AppError(HTTP_STATUS.CONFLICT, "Insufficient stock.");

      // Initial Fetch
      let cart = await Cart.findOne({ user: { $eq: safeUserId } }).session(
        session,
      );

      if (!cart) {
        const newCarts = await Cart.create([{ user: safeUserId, items: [] }], {
          session,
        });
        const createdCart = newCarts[0];

        // Safety check to satisfy the 'undefined' error
        if (!createdCart) {
          throw new AppError(
            HTTP_STATUS.INTERNAL_SERVER_ERROR,
            "Failed to initialize cart session.",
          );
        }
        cart = createdCart;
      }

      const safeAttributes = this.reconstructAttributes(selectedAttributes);
      const incomingSignature = this.generateItemSignature(
        productId,
        safeAttributes,
      );

      const existingIndex = cart.items.findIndex(
        (item) =>
          this.generateItemSignature(
            item.product.toString(),
            item.selectedAttributes as Record<string, AttributeValue>,
          ) === incomingSignature,
      );

      if (existingIndex > -1) {
        const item = cart.items[existingIndex];
        if (!item)
          throw new AppError(
            HTTP_STATUS.INTERNAL_SERVER_ERROR,
            "Cart state corruption detected.",
          );

        if (item.quantity + quantity > product.currentStock) {
          throw new AppError(HTTP_STATUS.CONFLICT, "Stock limit exceeded.");
        }
        item.quantity += quantity;
      } else {
        const newItem: ICartItem = {
          product: new Types.ObjectId(String(productId)),
          quantity,
        };

        if (safeAttributes) {
          newItem.selectedAttributes = safeAttributes;
        }

        // Use type assertion on the items array directly to avoid 'possibly null' errors
        (cart.items as unknown as ICartItem[]).push(newItem);
      }

      // Pass the non-null cart to the failsafe
      await this.recalculateCartTotals(cart, safeUserId, session);

      await cart.save({ session });
      await session.commitTransaction();

      return this.getCart(safeUserId);
    } catch (error) {
      await session.abortTransaction();
      logger.error(
        this.safeLog(
          `[CartService.addItem] Transaction Aborted: ${error instanceof Error ? error.message : "Unknown"}`,
        ),
      );
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * @method updateItemQuantity
   */
  public static async updateItemQuantity(
    userId: string,
    payload: UpdateCartItemInput,
  ) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { productId, quantity, selectedAttributes } = payload;
      const safeUserId = String(userId).replace(/[\r\n]/g, "");

      const cart = await Cart.findOne({ user: { $eq: safeUserId } }).session(
        session,
      );
      if (!cart) throw new AppError(HTTP_STATUS.NOT_FOUND, "Cart not found.");

      const targetSig = this.generateItemSignature(
        productId,
        selectedAttributes as Record<string, AttributeValue>,
      );
      const idx = cart.items.findIndex(
        (i) =>
          this.generateItemSignature(
            i.product.toString(),
            i.selectedAttributes as Record<string, AttributeValue>,
          ) === targetSig,
      );

      if (idx === -1)
        throw new AppError(HTTP_STATUS.NOT_FOUND, "Variant not in cart.");

      const product = await Product.findOne({ _id: { $eq: String(productId) } })
        .session(session)
        .lean();
      if (
        !product ||
        !product.isActive ||
        product.currentStock < (quantity ?? 0)
      ) {
        throw new AppError(
          HTTP_STATUS.CONFLICT,
          "Inventory error or product inactive.",
        );
      }

      cart.items[idx]!.quantity = quantity ?? 1;

      await this.recalculateCartTotals(cart, safeUserId, session);
      await cart.save({ session });
      await session.commitTransaction();

      return this.getCart(safeUserId);
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }
  /**
   * @method removeProduct
   */
  public static async removeProduct(userId: string, productId: string) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const safeUserId = String(userId).replace(/[\r\n]/g, "");
      const cart = await Cart.findOne({ user: { $eq: safeUserId } }).session(
        session,
      );
      if (!cart) return;

      const filteredItems = cart.items.filter(
        (item) => item.product.toString() !== productId,
      );
      cart.items = filteredItems as unknown as typeof cart.items;

      await this.recalculateCartTotals(cart, safeUserId, session);
      await cart.save({ session });
      await session.commitTransaction();
      return this.getCart(safeUserId);
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * @method clearCart
   * @description FIX: Moved into Service layer for production consistency[cite: 3].
   */
  public static async clearCart(userId: string): Promise<void> {
    const safeUserId = String(userId).replace(/[\r\n]/g, "");
    const result = await Cart.findOneAndUpdate(
      { user: { $eq: safeUserId } },
      {
        $set: {
          items: [],
          appliedCoupon: null,
          discountAmount: 0,
          totalAfterDiscount: 0,
        },
      },
      { new: true },
    );

    if (!result) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, "Cart not found to clear.");
    }
  }

  /**
   * @method mergeGuestCart
   * @description Merges guest items into persistent storage using atomic transactions.
   */
  public static async mergeGuestCart(
    userId: string,
    guestItems: MergeCartInput["items"],
  ) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const safeUserId = String(userId).replace(/[\r\n]/g, "");
      let cart = await Cart.findOne({ user: { $eq: safeUserId } }).session(
        session,
      );

      if (!cart) {
        const newCarts = await Cart.create([{ user: safeUserId, items: [] }], {
          session,
        });
        const createdCart = newCarts[0];
        if (!createdCart) {
          throw new AppError(
            HTTP_STATUS.INTERNAL_SERVER_ERROR,
            "Cart initialization failed.",
          );
        }
        cart = createdCart;
      }

      for (const guestItem of guestItems) {
        const product = await Product.findOne({
          _id: { $eq: String(guestItem.productId) },
        })
          .session(session)
          .lean();
        if (!product || !product.isActive || product.currentStock < 1) continue;

        const safeAttrs = this.reconstructAttributes(
          guestItem.selectedAttributes,
        );
        const incomingSig = this.generateItemSignature(
          guestItem.productId,
          safeAttrs,
        );

        const existingIdx = cart.items.findIndex(
          (i) =>
            this.generateItemSignature(
              i.product.toString(),
              i.selectedAttributes as Record<string, AttributeValue>,
            ) === incomingSig,
        );

        if (existingIdx > -1) {
          const item = cart.items[existingIdx];
          if (item) {
            item.quantity = Math.min(
              item.quantity + guestItem.quantity,
              product.currentStock,
            );
          }
        } else {
          const newItem: ICartItem = {
            product: new Types.ObjectId(String(guestItem.productId)),
            quantity: Math.min(guestItem.quantity, product.currentStock),
          };
          if (safeAttrs) newItem.selectedAttributes = safeAttrs;

          (cart.items as unknown as ICartItem[]).push(newItem);
        }
      }

      await this.recalculateCartTotals(cart, safeUserId, session);
      await cart.save({ session });
      await session.commitTransaction();

      return this.getCart(safeUserId);
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   *
   * PROMOTIONAL ENGINE: APPLY COUPON
   *
   */
  public static async applyCoupon(userId: string, code: string) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const safeUserId = String(userId).replace(/[\r\n]/g, "");
      const safeCode = String(code)
        .trim()
        .toUpperCase()
        .replace(/[\r\n]/g, "");

      const cart = await Cart.findOne({ user: { $eq: safeUserId } })
        .populate({
          path: "items.product",
          select: "basePrice discount isActive",
        })
        .session(session);

      if (!cart || cart.items.length === 0)
        throw new AppError(HTTP_STATUS.BAD_REQUEST, "Cart is empty.");

      const subtotal = cart.items.reduce((total: number, item: unknown) => {
        const populated = item as IPopulatedCartItem;
        if (!populated.product?.isActive) return total;
        const price =
          populated.product.basePrice * (1 - populated.product.discount / 100);
        return total + populated.quantity * price;
      }, 0);

      const { couponId, discountAmount } =
        await CouponService.validateAndCalculateDiscount(
          safeCode,
          subtotal,
          safeUserId,
        );

      cart.appliedCoupon = couponId;
      cart.discountAmount = discountAmount;
      cart.totalAfterDiscount = subtotal - discountAmount;

      await cart.save({ session });
      await session.commitTransaction();
      return cart;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   *
   * PROMOTIONAL ENGINE: REMOVE COUPON
   *
   */
  public static async removeCoupon(userId: string) {
    const safeUserId = String(userId).replace(/[\r\n]/g, "");
    const cart = await Cart.findOneAndUpdate(
      { user: { $eq: safeUserId } },
      {
        $set: { appliedCoupon: null, discountAmount: 0, totalAfterDiscount: 0 },
      },
      { new: true },
    );
    if (!cart) throw new AppError(HTTP_STATUS.NOT_FOUND, "Cart not found.");
    return cart;
  }

  /**
   * @method recalculateCartTotals
   * @description The margin-protection failsafe. Uses 'null' for exactOptionalPropertyTypes compliance.
   */
  public static async recalculateCartTotals<
    T extends ICart & mongoose.Document,
  >(cart: T, userId: string, session?: ClientSession) {
    if (!cart.appliedCoupon) return cart;

    await cart.populate({
      path: "items.product",
      select: "basePrice discount isActive",
    });

    const subtotal = cart.items.reduce((total: number, item: unknown) => {
      const populated = item as IPopulatedCartItem;
      if (!populated.product?.isActive) return total;
      const price =
        populated.product.basePrice * (1 - populated.product.discount / 100);
      return total + populated.quantity * price;
    }, 0);

    const coupon = await CouponModel.findById(cart.appliedCoupon)
      .session(session || null)
      .lean();

    // Logic: If subtotal falls below threshold or coupon expires, strip it.
    if (!coupon || subtotal < coupon.minCartValue || !coupon.isActive) {
      cart.appliedCoupon = null;
      cart.discountAmount = 0;
      cart.totalAfterDiscount = 0;
    } else {
      try {
        const result = await CouponService.validateAndCalculateDiscount(
          coupon.code,
          subtotal,
          userId,
        );
        cart.discountAmount = result.discountAmount;
        cart.totalAfterDiscount = subtotal - result.discountAmount;
      } catch (err) {
        cart.appliedCoupon = null;
        cart.discountAmount = 0;
        cart.totalAfterDiscount = 0;
      }
    }
    return cart;
  }

  /**
   * DPDP / GDPR Legal Engine: The State Wiper
   * * ARCHITECTURE NOTE:
   * Permanently deletes the user's cart from the database during account deletion.
   * Wrapped in the Orchestrator's ACID session to guarantee atomicity.
   */
  public static async deleteUserCart(
    userId: string,
    session: mongoose.ClientSession,
  ) {
    const safeUserId = String(userId).replace(/[\r\n]/g, "");

    // Physically erase the document. Soft deletes are not legally sufficient here.
    const result = await Cart.deleteOne(
      { user: { $eq: safeUserId } },
      { session },
    );

    logger.info(
      this.safeLog(
        `[Privacy Engine] Erased cart for deleted user ${safeUserId}`,
      ),
    );

    return result;
  }
}

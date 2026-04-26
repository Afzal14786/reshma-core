import { Types } from "mongoose";
import { Cart } from "./cart.model";
import { Product } from "../products/models/base-product.model";
import { AppError } from "../../shared/utils/app-error";
import { HTTP_STATUS } from "../../shared/constant/http-codes";
import {
  AddItemToCartInput,
  UpdateCartItemInput,
  MergeCartInput,
} from "./dtos/cart.dto";
import { AttributeValue, ICartItem } from "./interfaces/cart.interface";

/**
 * @interface ICartTotals
 * @description The dynamically calculated financial and shipping metrics for the cart.
 */
interface ICartTotals {
  subTotal: number;
  totalWeightGrams: number;
  hasFragileItems: boolean;
  totalItems: number;
}

/**
 * Cart Service
 * Handles all business logic, dynamic price calculations, and stock synchronization.
 */
export class CartService {
  /**
   * @method generateItemSignature
   * @private
   * @description Generates a deterministic string hash of the selected attributes.
   * Ensures that { size: 'M', color: 'Red' } and { color: 'Red', size: 'M' }
   * result in the exact same signature so they merge into a single cart item.
   */
  private static generateItemSignature(
    productId: string,
    attributes?: Record<string, AttributeValue>,
  ): string {
    if (!attributes || Object.keys(attributes).length === 0) {
      return productId;
    }

    // Sort the keys alphabetically to ensure deterministic output
    const sortedKeys = Object.keys(attributes).sort();
    const attributeString = sortedKeys
      .map((key) => `${key}:${attributes[key]}`)
      .join("|");

    return `${productId}|${attributeString}`;
  }

  /**
   * @method getCart
   * @description Fetches the cart, populates live product data, and acts as a "Self-Healing" mechanism
   * by purging items that have been deleted or deactivated by the admin.
   */
  public static async getCart(userId: string) {
    // Fetch or Create Cart (Upsert)
    let cart = await Cart.findOne({ user: { $eq: String(userId) } }).populate({
      path: "items.product",
      select:
        "name sku basePrice discount currentStock weightGrams isFragile isActive images itemType",
    });

    if (!cart) {
      cart = await Cart.create({ user: userId, items: [] });
      return {
        cart,
        totals: {
          subTotal: 0,
          totalWeightGrams: 0,
          hasFragileItems: false,
          totalItems: 0,
        },
      };
    }

    let needsSave = false;
    const validItems = [];
    const totals: ICartTotals = {
      subTotal: 0,
      totalWeightGrams: 0,
      hasFragileItems: false,
      totalItems: 0,
    };

    // The Self-Healing Iteration
    for (const item of cart.items) {
      // Because we populated, 'item.product' is now the full product object (or null if deleted)
      const product = item.product as any;

      // FIREWALL: If product was hard-deleted or soft-deleted, we drop it from the cart
      if (!product || product.isActive === false) {
        needsSave = true;
        continue; // Skip pushing to validItems
      }

      // Math Engine: Calculate actual price after product-level discount
      const activePrice =
        product.basePrice - product.basePrice * (product.discount / 100);

      totals.subTotal += activePrice * item.quantity;
      totals.totalWeightGrams += product.weightGrams * item.quantity;
      if (product.isFragile) totals.hasFragileItems = true;
      totals.totalItems += item.quantity;

      validItems.push(item);
    }

    // Heal the Database if dead items were found
    if (needsSave) {
      cart.items = validItems as any;
      await cart.save();
    }

    return {
      items: validItems,
      totals,
    };
  }

  /**
   * @method addItem
   * @description Safely adds an item to the cart or increments its quantity if a perfect
   * attribute match already exists. Strictly enforces inventory limits.
   */
  public static async addItem(userId: string, payload: AddItemToCartInput) {
    const { productId, quantity, selectedAttributes } = payload;

    // Stock & Validation Check
    const product = await Product.findOne({ _id: { $eq: String(productId) } })
      .select("currentStock isActive")
      .lean();

    if (!product || !product.isActive) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        "This product is no longer available.",
      );
    }

    if (product.currentStock < quantity) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        `Only ${product.currentStock} items left in stock.`,
      );
    }

    // Fetch User Cart
    let cart = await Cart.findOne({ user: { $eq: String(userId) } });
    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    // Match Signatures to prevent duplicates
    const incomingSignature = this.generateItemSignature(
      productId,
      selectedAttributes as Record<string, AttributeValue>,
    );

    const existingItemIndex = cart.items.findIndex((item) => {
      const itemSignature = this.generateItemSignature(
        item.product.toString(),
        item.selectedAttributes as Record<string, AttributeValue>,
      );
      return itemSignature === incomingSignature;
    });

    if (existingItemIndex > -1) {
      // Item exists. Safely extract it to satisfy strictNullChecks.
      const existingItem = cart.items[existingItemIndex];

      if (existingItem) {
        const newQuantity = existingItem.quantity + quantity;

        if (newQuantity > product.currentStock) {
          throw new AppError(
            HTTP_STATUS.CONFLICT,
            `Cannot add more. Stock limit reached (${product.currentStock}).`,
          );
        }

        existingItem.quantity = newQuantity;
      }
    } else {
      // New Item creation
      // This prevents passing 'undefined', which violates exactOptionalPropertyTypes.
      const newItemObject: Partial<ICartItem> = {
        product: new Types.ObjectId(productId),
        quantity,
        ...(selectedAttributes
          ? {
              selectedAttributes: selectedAttributes as Record<
                string,
                AttributeValue
              >,
            }
          : {}),
      };

      cart.items.push(newItemObject as any);
    }

    await cart.save();
    return this.getCart(userId); // Return the fully populated and calculated cart
  }

  /**
   * @method updateItemQuantity
   * @description Directly sets the quantity of a specific product variant in the cart.
   */
  public static async updateItemQuantity(
    userId: string,
    payload: UpdateCartItemInput,
  ) {
    const { productId, quantity, selectedAttributes } = payload;

    if (quantity === undefined) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        "Quantity is required for this operation.",
      );
    }

    const cart = await Cart.findOne({ user: { $eq: String(userId) } });
    if (!cart) throw new AppError(HTTP_STATUS.NOT_FOUND, "Cart not found.");

    const targetSignature = this.generateItemSignature(
      productId,
      selectedAttributes as Record<string, AttributeValue>,
    );

    const itemIndex = cart.items.findIndex(
      (item) =>
        this.generateItemSignature(
          item.product.toString(),
          item.selectedAttributes as Record<string, AttributeValue>,
        ) === targetSignature,
    );

    if (itemIndex === -1) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        "Item variant not found in cart.",
      );
    }

    // Real-time stock verification
    const product = await Product.findOne({ _id: { $eq: String(productId) } })
      .select("currentStock isActive")
      .lean();

    if (!product || !product.isActive || product.currentStock < quantity) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        `Requested quantity exceeds available stock (${product?.currentStock || 0}).`,
      );
    }

    // Safely update the item to satisfy strictNullChecks
    const targetItem = cart.items[itemIndex];
    if (targetItem) {
      targetItem.quantity = quantity;
    }

    await cart.save();

    return this.getCart(userId);
  }

  /**
   * @method removeProduct
   * @description Completely removes all variations of a specific product from the cart.
   */
  public static async removeProduct(userId: string, productId: string) {
    const cart = await Cart.findOne({ user: { $eq: String(userId) } });
    if (!cart) return;

    // Filter out the item(s) matching the Product ID
    cart.items = cart.items.filter(
      (item) => item.product.toString() !== productId,
    ) as any;

    await cart.save();
    return this.getCart(userId);
  }

  /**
   * @method clearCart
   * @description Empties the cart. Used immediately after a successful checkout.
   */
  public static async clearCart(userId: string): Promise<void> {
    await Cart.findOneAndUpdate(
      { user: { $eq: String(userId) } },
      { items: [] },
    );
  }

  /**
   * @method mergeGuestCart
   * @description Merges a frontend local-storage cart with the user's database cart upon login.
   * Intelligently prevents exceeding available stock and safely ignores discontinued products.
   */
  public static async mergeGuestCart(
    userId: string,
    guestItems: MergeCartInput["items"],
  ) {
    if (!guestItems || guestItems.length === 0) {
      return this.getCart(userId);
    }

    let cart = await Cart.findOne({ user: { $eq: String(userId) } });
    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    for (const guestItem of guestItems) {
      // Verify product still exists and is active
      const product = await Product.findOne({
        _id: { $eq: String(guestItem.productId) },
      })
        .select("currentStock isActive")
        .lean();

      // Silently drop items that are dead or out of stock (don't crash the merge)
      if (!product || !product.isActive || product.currentStock < 1) {
        continue;
      }

      const incomingSignature = this.generateItemSignature(
        guestItem.productId,
        guestItem.selectedAttributes as Record<string, AttributeValue>,
      );

      const existingItemIndex = cart.items.findIndex(
        (item) =>
          this.generateItemSignature(
            item.product.toString(),
            item.selectedAttributes as Record<string, AttributeValue>,
          ) === incomingSignature,
      );

      if (existingItemIndex > -1) {
        const existingItem = cart.items[existingItemIndex];
        if (existingItem) {
          const combinedQuantity = existingItem.quantity + guestItem.quantity;
          // Cap the merged quantity to the maximum available stock
          existingItem.quantity = Math.min(
            combinedQuantity,
            product.currentStock,
          );
        }
      } else {
        // Add new item, ensuring we don't exceed stock right off the bat
        const newItemObject: Partial<ICartItem> = {
          product: new Types.ObjectId(guestItem.productId),
          quantity: Math.min(guestItem.quantity, product.currentStock),
          ...(guestItem.selectedAttributes
            ? {
                selectedAttributes: guestItem.selectedAttributes as Record<
                  string,
                  AttributeValue
                >,
              }
            : {}),
        };
        cart.items.push(newItemObject as any);
      }
    }

    await cart.save();
    return this.getCart(userId); // Return the fully calculated and populated result
  }
}

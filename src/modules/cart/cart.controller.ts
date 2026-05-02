import { Request, Response } from "express";
import { CartService } from "./cart.service";
import { ApiResponse } from "@shared/utils/api-response";
import { HTTP_STATUS } from "@shared/constant/http-codes";
import {
  AddItemToCartInput,
  UpdateCartItemInput,
  MergeCartInput,
} from "./dtos/cart.dto";

/**
 * @class CartController
 * @description The presentation layer for the Cart module.
 * Intercepts HTTP requests, extracts the authenticated user's identity,
 * passes strictly validated payloads to the CartService, and dispatches uniform JSON responses.
 */
export class CartController {
  /**
   * @method getCart
   * @description Retrieves the active user's cart, complete with dynamically calculated totals
   * and real-time inventory checks (Self-Healing).
   */
  public static async getCart(req: Request, res: Response) {
    // req.user is guaranteed to exist by the 'protect' authentication middleware.
    const userId = String(req.user!._id);

    // Calls the newly architected dynamic cart engine
    const cartData = await CartService.getCart(userId);

    return new ApiResponse(
      res,
      HTTP_STATUS.OK,
      "Cart retrieved successfully",
      cartData,
    ).send();
  }

  /**
   * @method addItem
   * @description Adds a new item to the cart or increments the quantity of an exact existing match.
   */
  public static async addItem(req: Request, res: Response) {
    const userId = String(req.user!._id);

    // Payload has been strictly validated and sanitized by Zod DTO
    const payload = req.body as AddItemToCartInput;

    const updatedCart = await CartService.addItem(userId, payload);

    return new ApiResponse(
      res,
      HTTP_STATUS.OK,
      "Item added to cart successfully",
      updatedCart,
    ).send();
  }

  /**
   * @method updateItem
   * @description Directly modifies the quantity of a specific cart item variant.
   */
  public static async updateItem(req: Request, res: Response) {
    const userId = String(req.user!._id);
    const payload = req.body as UpdateCartItemInput;

    const updatedCart = await CartService.updateItemQuantity(userId, payload);

    return new ApiResponse(
      res,
      HTTP_STATUS.OK,
      "Cart updated successfully",
      updatedCart,
    ).send();
  }

  /**
   * @method removeProduct
   * @description Completely removes a product (and all its variants) from the user's cart.
   */
  public static async removeItem(req: Request, res: Response) {
    const userId = String(req.user!._id);

    // Explicit string conversion to prevent object prototype injection from params
    const productId = String(req.params.productId);

    const updatedCart = await CartService.removeProduct(userId, productId);

    return new ApiResponse(
      res,
      HTTP_STATUS.OK,
      "Item removed from cart",
      updatedCart,
    ).send();
  }

  /**
   * @method clearCart
   * @description Empties the cart entirely. Typically called post-checkout or via a user "Empty Cart" button.
   */
  public static async clearCart(req: Request, res: Response) {
    const userId = String(req.user!._id);

    await CartService.clearCart(userId);

    return new ApiResponse(
      res,
      HTTP_STATUS.OK,
      "Cart cleared successfully",
      null,
    ).send();
  }

  /**
   * @method mergeCart
   * @description Triggered immediately after a user logs in. Takes the guest cart from frontend
   * LocalStorage and securely merges it with their persistent database cart.
   */
  public static async mergeCart(req: Request, res: Response) {
    const userId = String(req.user!._id);
    const payload = req.body as MergeCartInput;

    const mergedCart = await CartService.mergeGuestCart(userId, payload.items);

    return new ApiResponse(
      res,
      HTTP_STATUS.OK,
      "Guest cart merged successfully",
      mergedCart,
    ).send();
  }
}

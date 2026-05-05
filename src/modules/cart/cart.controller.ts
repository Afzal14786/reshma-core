import { Request, Response, NextFunction } from "express";
import { CartService } from "./cart.service";
import { ApiResponse } from "@shared/utils/api-response";
import { HTTP_STATUS } from "@shared/constant/http-codes";
import {
  AddItemToCartInput,
  UpdateCartItemInput,
  MergeCartInput,
} from "./dtos/cart.dto";

/**
 * PRODUCTION-GRADE WRAPPER
 * @description Ensures all asynchronous errors are forwarded to the global error middleware
 * without cluttering every controller method with try/catch blocks.
 */
const catchAsync = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
};

/**
 * @class CartController
 * @description The presentation layer for the Cart module.
 * ARCHITECTURE NOTE: This class uses static methods wrapped in catchAsync to maintain
 * absolute process stability and uniform error propagation.
 */
export class CartController {
  /**
   * @method getCart
   */
  public static getCart = catchAsync(async (req: Request, res: Response) => {
    const userId = String(req.user!._id);
    const cartData = await CartService.getCart(userId);

    return new ApiResponse(
      res,
      HTTP_STATUS.OK,
      "Cart retrieved successfully",
      cartData,
    ).send();
  });

  /**
   * @method addItem
   */
  public static addItem = catchAsync(async (req: Request, res: Response) => {
    const userId = String(req.user!._id);
    const payload = req.body as AddItemToCartInput;
    const updatedCart = await CartService.addItem(userId, payload);

    return new ApiResponse(
      res,
      HTTP_STATUS.OK,
      "Item added to cart successfully",
      updatedCart,
    ).send();
  });

  /**
   * @method updateItem
   */
  public static updateItem = catchAsync(async (req: Request, res: Response) => {
    const userId = String(req.user!._id);
    const payload = req.body as UpdateCartItemInput;
    const updatedCart = await CartService.updateItemQuantity(userId, payload);

    return new ApiResponse(
      res,
      HTTP_STATUS.OK,
      "Cart updated successfully",
      updatedCart,
    ).send();
  });

  /**
   * @method removeItem
   * @description FIX: Corrected the service method reference from removeProduct to removeProduct.
   */
  public static removeItem = catchAsync(async (req: Request, res: Response) => {
    const userId = String(req.user!._id);
    const productId = String(req.params.productId);

    // LOGIC FIX: Calling the correct service method implemented in cart.service.ts
    const updatedCart = await CartService.removeProduct(userId, productId);

    return new ApiResponse(
      res,
      HTTP_STATUS.OK,
      "Item removed from cart",
      updatedCart,
    ).send();
  });

  /**
   * @method clearCart
   */
  public static clearCart = catchAsync(async (req: Request, res: Response) => {
    const userId = String(req.user!._id);
    await CartService.clearCart(userId);

    return new ApiResponse(
      res,
      HTTP_STATUS.OK,
      "Cart cleared successfully",
      null,
    ).send();
  });

  /**
   * @method mergeCart
   */
  public static mergeCart = catchAsync(async (req: Request, res: Response) => {
    const userId = String(req.user!._id);
    const payload = req.body as MergeCartInput;
    const mergedCart = await CartService.mergeGuestCart(userId, payload.items);

    return new ApiResponse(
      res,
      HTTP_STATUS.OK,
      "Guest cart merged successfully",
      mergedCart,
    ).send();
  });

  /**
   *
   * PROMOTIONAL HOOKS
   *
   */

  /**
   * @route   POST /api/v1/cart/coupon/apply
   */
  public static applyCoupon = catchAsync(
    async (req: Request, res: Response) => {
      const userId = String(req.user!._id);
      const { code } = req.body;

      // SECURITY (CodeQL): Primitive check to prevent NoSQL object injection
      if (!code || typeof code !== "string") {
        return new ApiResponse(
          res,
          HTTP_STATUS.BAD_REQUEST,
          "A valid promotional code string is required.",
          null,
        ).send();
      }

      const updatedCart = await CartService.applyCoupon(userId, code.trim());

      return new ApiResponse(
        res,
        HTTP_STATUS.OK,
        "Promotional code applied successfully.",
        updatedCart,
      ).send();
    },
  );

  /**
   * @route   DELETE /api/v1/cart/coupon/remove
   */
  public static removeCoupon = catchAsync(
    async (req: Request, res: Response) => {
      const userId = String(req.user!._id);
      const updatedCart = await CartService.removeCoupon(userId);

      return new ApiResponse(
        res,
        HTTP_STATUS.OK,
        "Promotional code removed from cart.",
        updatedCart,
      ).send();
    },
  );
}

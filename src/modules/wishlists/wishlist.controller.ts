import { Request, Response, NextFunction } from "express";
import { WishlistService } from "./wishlist.service";
import { ApiResponse } from "@shared/utils/api-response";
import { HTTP_STATUS } from "@shared/constant/http-codes";
import { AddWishlistItemInput, MoveToCartInput } from "./dtos/wishlist.dto";

/**
 * PRODUCTION-GRADE WRAPPER
 * @description Ensures all asynchronous errors (like DB timeouts or transaction aborts)
 * are gracefully forwarded to the global error middleware to prevent hanging requests.
 */
const catchAsync = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
};

/**
 * @class WishlistController
 * @description The presentation layer for the Wishlist module.
 * ARCHITECTURE NOTE: This class uses static methods wrapped in catchAsync to maintain
 * absolute process stability. It explicitly trusts the Zod DTOs to provide sanitized payloads.
 */
export class WishlistController {
  /**
   * @method getWishlist
   * @description Fetches the user's active wishlist (triggers self-healing under the hood).
   */
  public static getWishlist = catchAsync(
    async (req: Request, res: Response) => {
      const userId = String(req.user!._id);

      const wishlistData = await WishlistService.getWishlist(userId);

      return new ApiResponse(
        res,
        HTTP_STATUS.OK,
        "Wishlist retrieved successfully",
        wishlistData,
      ).send();
    },
  );

  /**
   * @method addItem
   * @description Appends a product to the user's wishlist document.
   */
  public static addItem = catchAsync(async (req: Request, res: Response) => {
    const userId = String(req.user!._id);
    const payload = req.body as AddWishlistItemInput;

    const updatedWishlist = await WishlistService.addItem(userId, payload);

    return new ApiResponse(
      res,
      HTTP_STATUS.OK,
      "Item added to wishlist successfully",
      updatedWishlist,
    ).send();
  });

  /**
   * @method removeItem
   * @description Surgically removes a product from the wishlist array.
   */
  public static removeItem = catchAsync(async (req: Request, res: Response) => {
    const userId = String(req.user!._id);
    const productId = String(req.params.productId);

    const updatedWishlist = await WishlistService.removeItem(userId, productId);

    return new ApiResponse(
      res,
      HTTP_STATUS.OK,
      "Item removed from wishlist",
      updatedWishlist,
    ).send();
  });

  /**
   * @method moveToCart
   * @description Integrates with the Cart module's ACID transaction to transfer the item.
   */
  public static moveToCart = catchAsync(async (req: Request, res: Response) => {
    const userId = String(req.user!._id);
    const productId = String(req.params.productId);
    const payload = req.body as MoveToCartInput;

    const updatedWishlist = await WishlistService.moveToCart(
      userId,
      productId,
      payload,
    );

    return new ApiResponse(
      res,
      HTTP_STATUS.OK,
      "Item successfully moved to cart",
      updatedWishlist,
    ).send();
  });

  /**
   * @method clearWishlist
   * @description Empties the user's wishlist completely.
   */
  public static clearWishlist = catchAsync(
    async (req: Request, res: Response) => {
      const userId = String(req.user!._id);

      await WishlistService.clearWishlist(userId);

      return new ApiResponse(
        res,
        HTTP_STATUS.OK,
        "Wishlist cleared successfully",
        null,
      ).send();
    },
  );
}

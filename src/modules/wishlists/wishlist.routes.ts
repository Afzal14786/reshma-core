import { Router } from "express";
import { WishlistController } from "./wishlist.controller";

// Global Middlewares
import { protect } from "@shared/middlewares/auth.middleware";
import { validate } from "@shared/middlewares/validate.middleware";
import { standardLimiter } from "@shared/middlewares/rate-limit.middleware";

// Zod Validation Schemas
import {
  AddWishlistItemSchema,
  RemoveWishlistItemSchema,
  MoveToCartSchema,
} from "./dtos/wishlist.dto";

const router = Router();

/**
 * @module WishlistRoutes
 * @description Protected Customer Routes for the Wishlist domain.
 */

// SECURITY CONFIGURATION (CodeQL CWE-770 & CWE-285 Mitigation)
// `standardLimiter`: Applied globally to prevent DoS attacks and enumeration bots.
// `protect`: Mathematically verifies the JWT to guarantee the `req.user` identity.
// By chaining these together at the top level, we ensure no unauthenticated or
// malicious rapid-fire requests ever touch the expensive database queries.
router.use(standardLimiter, protect);

/**
 * @route   GET /api/v1/wishlists
 * @desc    Fetch the user's populated wishlist (Self-Healing)
 */
router.get("/", WishlistController.getWishlist);

/**
 * @route   POST /api/v1/wishlists/add
 * @desc    Appends a new product to the wishlist
 * @security validate() drops invalid Hex strings, mitigating NoSQL Object Injection
 */
router.post(
  "/add",
  validate(AddWishlistItemSchema),
  WishlistController.addItem,
);

/**
 * @route   POST /api/v1/wishlists/move-to-cart/:productId
 * @desc    Cross-module transfer. Removes from wishlist, adds to cart.
 * @security validate() strictly filters the incoming 'selectedAttributes' object
 */
router.post(
  "/move-to-cart/:productId",
  validate(MoveToCartSchema),
  WishlistController.moveToCart,
);

/**
 * @route   DELETE /api/v1/wishlists/item/:productId
 * @desc    Surgically drops a specific product using atomic $pull
 */
router.delete(
  "/item/:productId",
  validate(RemoveWishlistItemSchema),
  WishlistController.removeItem,
);

/**
 * @route   DELETE /api/v1/wishlists/clear
 * @desc    Empties the entire wishlist array
 */
router.delete("/clear", WishlistController.clearWishlist);

export const WishlistRoutes = router;

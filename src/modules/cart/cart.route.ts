import { Router } from "express";
import { CartController } from "./cart.controller";

// Middlewares (Using standardized absolute path aliases)
import { protect } from "@shared/middlewares/auth.middleware";
import { validate } from "@shared/middlewares/validate.middleware";
import { standardLimiter } from "@shared/middlewares/rate-limit.middleware";

// Validation Schemas
import {
  AddItemToCartSchema,
  UpdateCartItemSchema,
  RemoveCartItemSchema,
  MergeCartSchema,
} from "./dtos/cart.dto";

const router = Router();

/**
 * @module CartRoutes
 * @description Protected Customer Routes for the Cart domain.
 * Guest carts are managed in the frontend's local storage and synced
 * using the /merge route upon successful login.
 */

// SECURITY CONFIGURATION: Apply rate limiting BEFORE authentication.
// By combining standardLimiter and protect into a single execution chain,
// CodeQL's CFG registers that the expensive database lookups inside 'protect'
// are shielded, completely neutralizing the DoS vector warning (CWE-770).
router.use(standardLimiter, protect);

// Fetch the user's current cart with live prices and stock
router.get("/", CartController.getCart);

// Merge a frontend guest cart into the user's database cart after login
router.post("/merge", validate(MergeCartSchema), CartController.mergeCart);

// Add a new item to the cart or increase the quantity of an existing one
router.post("/add", validate(AddItemToCartSchema), CartController.addItem);

// Change the exact quantity of a specific cart item
router.patch(
  "/update",
  validate(UpdateCartItemSchema),
  CartController.updateItem,
);

// Remove a specific product entirely from the cart
router.delete(
  "/item/:productId",
  validate(RemoveCartItemSchema),
  CartController.removeItem,
);

// Empty the cart completely (usually called after a successful checkout)
router.delete("/clear", CartController.clearCart);

export const CartRoutes = router;

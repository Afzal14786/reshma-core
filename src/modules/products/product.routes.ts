import { Router } from "express";
import { AdminProductController } from "./controllers/product.admin.controller";
import { PublicProductController } from "./controllers/product.public.controller";

// Middleware Imports
import { protect } from "@shared/middlewares/auth.middleware";
import { restrictTo } from "@shared/middlewares/role.middleware";
import { validate } from "@shared/middlewares/validate.middleware";
import { uploadProductImage } from "@shared/middlewares/upload.middleware";
import { standardLimiter } from "@shared/middlewares/rate-limit.middleware";
import { cacheMiddleware } from "@shared/middlewares/cache.middleware";

// DTO Imports
import {
  CreateProductSchema,
  UpdateProductSchema,
} from "./dtos/product.admin.dto";

import {
  GetProductsQuerySchema,
  GetProductByIdSchema,
} from "./dtos/product.public.dto";

const router = Router();

/**
 * PUBLIC ROUTES (Customer Facing)
 * Open access. Protected explicitly by the standard rate limiter.
 */

router.get(
  "/",
  standardLimiter,
  cacheMiddleware(300),
  validate(GetProductsQuerySchema),
  PublicProductController.getProducts,
);

router.get(
  "/:id",
  standardLimiter,
  cacheMiddleware(300),
  validate(GetProductByIdSchema),
  PublicProductController.getProductById,
);

/**
 * PROTECTED ROUTES (Admin Facing)
 * Requires Two-Token JWT verification AND 'ADMIN' database role.
 */

// CodeQL's static analyzer registers the protection over the database queries.
router.use(standardLimiter, protect, restrictTo("ADMIN"));

router.post(
  "/",
  uploadProductImage, // Intercept 'multipart/form-data' and buffer images to RAM
  validate(CreateProductSchema), // Zod Discriminator Firewall (strips invalid fields)
  AdminProductController.createProduct,
);

router.patch(
  "/:id",
  validate(UpdateProductSchema), // Validates types and ObjectId format
  AdminProductController.updateProduct,
);

router.delete(
  "/:id",
  validate(GetProductByIdSchema), // Reusing the ID validator from the public DTO
  AdminProductController.deleteProduct,
);

export const ProductRoutes = router;

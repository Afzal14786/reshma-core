import { Router } from "express";
import { AdminSearchController } from "./admin-search.controller";
import { protect } from "@shared/middlewares/auth.middleware";
import { restrictTo } from "@shared/middlewares/role.middleware";
import { validate } from "@shared/middlewares/validate.middleware";
import { AdminSearchQuerySchema } from "./dto/admin-search.dto";

const router = Router();

/**
 * ADMIN GLOBAL SEARCH ROUTE
 *
 * SECURITY BOUNDARY:
 * - protect: Ensures the user is logged in.
 * - restrictTo("ADMIN"): Ensures the user has admin privileges.
 * - validate(AdminSearchQuerySchema): Sanitizes the query parameter and strips
 *   control characters to prevent Log Injection (CWE-117).
 */
router.get(
  "/",
  protect,
  restrictTo("ADMIN"),
  validate(AdminSearchQuerySchema),
  AdminSearchController.globalSearch,
);

export const AdminSearchRoutes = router;

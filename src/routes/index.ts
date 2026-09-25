import { Router } from "express";
import { authRoutes } from "@modules/auth/auth.routes";
import { notificationRoutes } from "@modules/notifications/notification.routes";
import { ProductRoutes } from "@modules/products/product.routes";
import { CartRoutes } from "@modules/cart/cart.route";
import { OrderRoutes } from "@modules/orders/order.routes";
import { userRoutes } from "@modules/users/user.routes";
import { ReturnRoutes } from "@modules/returns/return.route";
import { interactionRoutes } from "@modules/interactions/interaction.routes";
import { CouponRoutes } from "@modules/coupons/coupon.routes";
import { WishlistRoutes } from "@modules/wishlists/wishlist.routes";
import { searchRoutes } from "@modules/search/search.routes";
import { DashboardRoutes } from "@modules/dashboard/dashboard.routes";
import { AdminSearchRoutes } from "@modules/admin-search/admin-search.routes";
import { AuditLogRoutes } from "@modules/audit-logs/audit-log.routes";
import { SupportRoute } from "@modules/support/support.routes";

import { HealthRoutes } from "@modules/health/health.routes";

const router = Router();

/**
 * Global API Router
 * * ARCHITECTURE NOTE:
 * We map all feature modules into a central array. This keeps the file clean
 * and makes it incredibly easy to manage versioning (e.g., /api/v1 vs /api/v2)
 * later on without touching the individual module files.
 */
const moduleRoutes = [
  {
    path: "/auth",
    route: authRoutes,
  },
  {
    path: "/notifications",
    route: notificationRoutes,
  },
  { path: "/products", route: ProductRoutes },
  { path: "/carts", route: CartRoutes },
  { path: "/orders", route: OrderRoutes },
  { path: "/users", route: userRoutes },
  { path: "/returns", route: ReturnRoutes },
  { path: "/interactions", route: interactionRoutes },
  { path: "/coupons", route: CouponRoutes },
  { path: "/wishlists", route: WishlistRoutes },
  { path: "/search", route: searchRoutes },
  { path: "/dashboards", route: DashboardRoutes },

  { path: "/health", route: HealthRoutes },
  { path: "/support", route: SupportRoute },
  { path: "/admin/search", route: AdminSearchRoutes },
  { path: "/admin/audit-logs", route: AuditLogRoutes },
];

// Iteratively mount all routes
moduleRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

export default router;

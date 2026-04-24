import { Router } from "express";
import { authRoutes } from "@modules/auth/auth.routes";
import { notificationRoutes } from "@modules/notifications/notification.routes";
import { ProductRoutes } from "@modules/products/product.routes";

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
    // { path: "/orders", route: orderRoutes },
];

// Iteratively mount all routes
moduleRoutes.forEach((route) => {
    router.use(route.path, route.route);
});

export default router;
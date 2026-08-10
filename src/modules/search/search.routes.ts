import { Router } from "express";
import { SearchController } from "./search.controller";
import { validate } from "@shared/middlewares/validate.middleware";
import { SearchQuerySchema } from "./dtos/search.dto";
// import { standardLimiter } from "@shared/middlewares/rate-limit.middleware";

const router = Router();

/**
 * SEARCH ROUTE CONFIGURATION
 *
 * ARCHITECTURE NOTE:
 * We mount the search endpoint as a public GET route.
 * 1. standardLimiter: Protects the Typesense RAM cluster from high-frequency scraping
 *    attacks and ensures availability for genuine users. This standardLimiter already set @app.ts file
 * 2. validate: Coerces and sanitizes URL query parameters against the SearchQuerySchema
 *    before they reach the controller, neutralizing potential injection vectors.
 */
router.get("/", validate(SearchQuerySchema), SearchController.search);

export const searchRoutes = router;

import { Router } from "express";
import { HealthController } from "./health.controller";
import { healthLimiter } from "@shared/middlewares/rate-limit.middleware";

const router = Router();

/**
 * ARCHITECTURE NOTE: Deep Probe Rate Limiting (CodeQL Hardened)
 * CodeQL accurately flagged that deep DB pings without limits are a DoS vector.
 * We apply a dedicated `healthLimiter` here. It allows up to 3000 requests per 15 mins
 * to perfectly accommodate AWS ELB/Kubernetes health checks, while strictly blocking
 * malicious actors from weaponizing this route to crash the database cluster.
 */

router.get("/", healthLimiter, HealthController.checkHealth);

export const HealthRoutes = router;

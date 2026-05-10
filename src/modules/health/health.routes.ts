import { Router } from "express";
import { HealthController } from "./health.controller";

const router = Router();

/**
 * ARCHITECTURE NOTE: Bypass Rate Limiting
 * We intentionally DO NOT apply `standardLimiter` to this route.
 * Load Balancers (AWS ELB) ping this route every 5 to 10 seconds (up to 180 times per 15 mins).
 * If we rate-limit this route, the Load Balancer will eventually receive a 429 Too Many Requests,
 * assume the server is dead, and cause a fake system-wide outage.
 */
router.get("/", HealthController.checkHealth);

export const HealthRoutes = router;

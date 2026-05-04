import { Router } from "express";
import { InteractionController } from "./interaction.controller";

// Middlewares
import { protect } from "@shared/middlewares/auth.middleware";
import { validate } from "@shared/middlewares/validate.middleware";
import { standardLimiter } from "@shared/middlewares/rate-limit.middleware";

// Zod DTOs
import { CreateInteractionSchema } from "./dtos/create-interaction.dto";
import { VoteInteractionSchema } from "./dtos/vote-interaction.dto";

const router = Router();

/**
 * PUBLIC ROUTES (Read-Heavy Operations)
 * @description Open to the public for SEO and catalog browsing.
 */

// Public endpoints without auth are the most vulnerable to Resource Exhaustion (DoS).
// We must throttle this to prevent database connection pool depletion.
router.get(
  "/product/:productId",
  standardLimiter,
  InteractionController.getProductInteractions,
);

/**
 * PROTECTED ROUTES (Write-Heavy Operations)
 * @description All routes below this line strictly require a valid JWT.
 */

// Authenticate first (Drops requests without a valid token)
router.use(protect);

/**
 * @route POST /api/v1/interactions/
 * @description Create a new Review or Threaded Comment.
 * @security Pipeline: Auth -> Rate Limit -> Zod DTO Validation -> Controller
 */
router.post(
  "/",
  standardLimiter,
  validate(CreateInteractionSchema),
  InteractionController.createInteraction,
);

/**
 * @route PATCH /api/v1/interactions/:interactionId/vote
 * @description Upvote or Downvote an interaction (Helpful/Unhelpful).
 * @security Pipeline: Auth -> Rate Limit -> Zod DTO Validation -> Controller
 */
router.patch(
  "/:interactionId/vote",
  standardLimiter,
  validate(VoteInteractionSchema),
  InteractionController.voteInteraction,
);

export const interactionRoutes = router;

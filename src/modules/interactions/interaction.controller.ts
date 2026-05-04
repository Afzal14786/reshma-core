import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { InteractionService } from "./interaction.service";
import { Interaction } from "./interaction.model";
import { HTTP_STATUS } from "@shared/constant/http-codes";
import { InteractionType } from "./interfaces/interaction.interface";
import { AppError } from "@shared/utils/app-error";

export class InteractionController {
  /**
   * CREATE INTERACTION (Review or Comment)
   * @route POST /api/v1/interactions
   * @access Protected (Requires valid JWT)
   */
  public static async createInteraction(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      // Guarantees to the TS compiler that userId is never undefined.
      const userId = req.user?._id?.toString();
      if (!userId || typeof userId !== "string") {
        throw new AppError(
          HTTP_STATUS.UNAUTHORIZED,
          "User authentication failed or is missing.",
        );
      }

      const payload = req.body;
      const interaction = await InteractionService.createInteraction(
        userId,
        payload,
      );

      res.status(HTTP_STATUS.CREATED).json({
        status: "success",
        message: "Interaction created successfully.",
        data: { interaction },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * VOTE ON INTERACTION (Helpful / Unhelpful)
   * @route PATCH /api/v1/interactions/:interactionId/vote
   * @access Protected (Requires valid JWT)
   */
  public static async voteInteraction(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user?._id?.toString();
      if (!userId || typeof userId !== "string") {
        throw new AppError(
          HTTP_STATUS.UNAUTHORIZED,
          "User authentication failed or is missing.",
        );
      }

      const interactionId = req.params.interactionId;
      if (!interactionId || typeof interactionId !== "string") {
        throw new AppError(
          HTTP_STATUS.BAD_REQUEST,
          "Interaction ID is missing or malformed.",
        );
      }

      const { action } = req.body;

      await InteractionService.voteOnInteraction(interactionId, userId, action);

      res.status(HTTP_STATUS.OK).json({
        status: "success",
        message: `Interaction successfully marked as ${action.toLowerCase()}.`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * FETCH PRODUCT INTERACTIONS (Paginated & Optimized)
   * @route GET /api/v1/interactions/product/:productId
   * @access Public
   * @description Fetches top-level reviews. Implements strict bounds to prevent
   * CWE-400 (Uncontrolled Resource Consumption).
   */
  public static async getProductInteractions(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const productId = req.params.productId;
      if (!productId || typeof productId !== "string") {
        throw new AppError(
          HTTP_STATUS.BAD_REQUEST,
          "Product ID is missing or malformed.",
        );
      }

      if (!Types.ObjectId.isValid(productId)) {
        throw new AppError(
          HTTP_STATUS.BAD_REQUEST,
          "Invalid Product ID format.",
        );
      }

      const rawPage = req.query.page;
      const rawLimit = req.query.limit;

      const parsedPage =
        typeof rawPage === "string" ? parseInt(rawPage, 10) : 1;
      const parsedLimit =
        typeof rawLimit === "string" ? parseInt(rawLimit, 10) : 10;

      // Mathematical enforcement of memory heap boundaries
      const page = Math.max(1, isNaN(parsedPage) ? 1 : parsedPage);
      const limit = Math.min(
        50,
        Math.max(1, isNaN(parsedLimit) ? 10 : parsedLimit),
      );
      const skip = (page - 1) * limit;

      // ARCHITECTURE NOTE: Only Top-Level REVIEWS are fetched.
      // Threaded replies are excluded to maintain O(1) payload sizes.
      const query = {
        productId: new Types.ObjectId(productId),
        type: InteractionType.REVIEW,
        parentId: null,
      };

      // Concurrent I/O execution. `lean()` strips Mongoose overhead.
      const [reviews, totalDocuments] = await Promise.all([
        Interaction.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate("userId", "firstName lastName avatar")
          .lean(),
        Interaction.countDocuments(query),
      ]);

      res.status(HTTP_STATUS.OK).json({
        status: "success",
        results: reviews.length,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalDocuments / limit),
          totalResults: totalDocuments,
        },
        data: { reviews },
      });
    } catch (error) {
      next(error);
    }
  }
}

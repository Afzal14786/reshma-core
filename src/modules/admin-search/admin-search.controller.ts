import { Request, Response } from "express";
import { AdminSearchService } from "./admin-search.service";
import { ApiResponse } from "@shared/utils/api-response";
import { HTTP_STATUS } from "@shared/constant/http-codes";

/**
 * ADMIN GLOBAL SEARCH CONTROLLER
 *
 * SECURITY BOUNDARY:
 * This controller is ONLY accessible to authenticated users with the "ADMIN" role.
 * The route-level `restrictTo("ADMIN")` middleware enforces this before the request
 * reaches this controller.
 */
export class AdminSearchController {
  /**
   * @route   GET /api/v1/admin/search
   * @desc    Perform a global search across Products, Orders, Users, Support, and Returns.
   * @access  Private (Admin Only)
   */
  public static async globalSearch(req: Request, res: Response) {
    // The Zod middleware guarantees `req.query.q` exists and is sanitized.
    const query = req.query.q as string;

    // Execute the parallel search
    const results = await AdminSearchService.globalSearch(query);

    // Return the grouped response
    return new ApiResponse(
      res,
      HTTP_STATUS.OK,
      `Global search results for "${query}"`,
      results,
    ).send();
  }
}

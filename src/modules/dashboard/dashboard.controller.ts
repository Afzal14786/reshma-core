import { Request, Response, NextFunction } from "express";
import { DashboardService } from "./dashboard.service";
import { DateRangeQueryInput } from "./dtos/date-range.dto";
import { ApiResponse } from "@shared/utils/api-response";
import { HTTP_STATUS } from "@shared/constant/http-codes";

/**
 * ADMIN DASHBOARD CONTROLLER
 *
 * ARCHITECTURE NOTE:
 * This controller is strictly for administrative analytics. It handles the
 * extraction of the Zod-validated date ranges and delegates the heavy
 * mathematical computations to the DashboardService.
 */
export class DashboardController {
  /**
   * @route   GET /api/v1/dashboard/metrics
   * @desc    Fetch aggregated business metrics, financials, and inventory alerts.
   * @access  Private (Admin Only)
   */
  public static async getMetrics(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      // The Zod middleware guarantees req.query matches DateRangeQueryInput
      const queryPayload = req.query as unknown as DateRangeQueryInput;

      const metrics = await DashboardService.getMetrics(queryPayload);

      new ApiResponse(
        res,
        HTTP_STATUS.OK,
        "Dashboard metrics retrieved successfully.",
        metrics,
      ).send();
    } catch (error) {
      next(error);
    }
  }
}

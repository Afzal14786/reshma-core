import { Request, Response, NextFunction } from "express";
import { SearchService } from "./search.service";
import { SearchQueryInput } from "./dtos/search.dto";
import { ApiResponse } from "@shared/utils/api-response";
import { HTTP_STATUS } from "@shared/constant/http-codes";

/**
 * SEARCH CONTROLLER
 *
 * ARCHITECTURE NOTE:
 * This controller acts as the entry point for the public catalog discovery API.
 * It is responsible for orchestrating the flow between the validated request
 * and the raw Typesense data, finaly wrapping the result in a standardized
 * ApiResponse envelope to maintain frontend consistency.
 */
export class SearchController {
  /**
   * @route   GET /api/v1/search
   * @desc    Execute a typo-tolerant, faceted search against the RAM cluster.
   * @access  Public
   */
  public static async search(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      /**
       * The 'req.query' object has been pre-sanitized and coerced by the
       * Zod validation middleware before reaching this point.
       */
      const queryData = req.query as unknown as SearchQueryInput;

      // Invoking the service to fetch raw RAM-indexed data
      const searchResults = await SearchService.executeSearch(queryData);

      /**
       * PRODUCTION-GRADE WRAPPING:
       * We utilize the standardized ApiResponse class to guarantee that the
       * frontend team receives a predictable JSON structure.
       */
      new ApiResponse(
        res,
        HTTP_STATUS.OK,
        "Search results retrieved successfully from the discovery engine.",
        searchResults,
      ).send();
    } catch (error) {
      /**
       * We pass the error to the next() middleware to ensure that the
       * Global Error Handler manages the response and logs.
       */
      next(error);
    }
  }
}

import { Request, Response } from "express";
import { ReturnService } from "./return.service";
import { ApiResponse } from "@shared/utils/api-response";
import { HTTP_STATUS } from "@shared/constant/http-codes";
import { InitiateReturnInput } from "./dtos/return.dto";

/**
 * PUBLIC RETURN CONTROLLER (Customer Facing)
 *
 * ARCHITECTURE NOTE:
 * This controller only exposes safe, read-only or initiation operations.
 * It strictly enforces IDOR protection by forcing all queries to use `req.user!._id`.
 */
export class ReturnPublicController {
  /**
   * @route   POST /api/v1/returns/:orderId/initiate
   * @desc    Customer triggers the Return State Machine
   * @access  Private (Logged-in user)
   */
  public static async initiateReturn(req: Request, res: Response) {
    // protect middleware guarantees req.user exists
    const userId = String(req.user!._id);
    const userEmail = req.user!.email;
    const userFirstname = req.user!.firstname;
    const orderId = String(req.params.orderId);

    // Zod validation middleware guarantees the payload shape
    const payload = req.body as InitiateReturnInput;

    const returnRequest = await ReturnService.initiateReturn(
      userId,
      userEmail,
      userFirstname,
      orderId,
      payload,
    );

    return new ApiResponse(
      res,
      HTTP_STATUS.CREATED,
      "Return request submitted successfully. Our team will review it shortly.",
      { returnRequest },
    ).send();
  }

  /**
   * @route   GET /api/v1/returns/me
   * @desc    Fetch the logged-in user's return history
   * @access  Private
   */
  public static async getMyReturns(req: Request, res: Response) {
    const userId = String(req.user!._id);

    // Pagination defaults
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const query = { user: { $eq: userId } };

    const { returns, meta } = await ReturnService.fetchReturns(
      query,
      limit,
      skip,
    );

    return new ApiResponse(
      res,
      HTTP_STATUS.OK,
      "Return history fetched successfully.",
      { returns, meta },
    ).send();
  }
}

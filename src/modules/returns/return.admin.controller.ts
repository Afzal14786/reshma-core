import { Request, Response } from "express";
import { ReturnService } from "./return.service";
import { ApiResponse } from "@shared/utils/api-response";
import { HTTP_STATUS } from "@shared/constant/http-codes";
import { ArbitrateReturnInput } from "./dtos/return.dto";
import { getAuditContext } from "@shared/utils/audit.utils";

/**
 * ADMIN RETURN CONTROLLER (Internal Operations)
 *
 * SECURITY BOUNDARY:
 * These routes must be protected by the `restrictTo("ADMIN")` middleware.
 * Exposes financial mutation methods (Refunds) and Inventory overrides (Restocks).
 */
export class ReturnAdminController {
  /**
   * @route   GET /api/v1/returns/admin
   * @desc    View all return requests across the platform (The Arbitration Queue)
   * @access  Private (Admin Only)
   */
  public static async getAllReturns(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Admins can filter by status (e.g., ?status=PENDING_APPROVAL)
    const query: Record<string, unknown> = {};
    if (req.query.status) {
      query.status = { $eq: String(req.query.status) };
    }

    const { returns, meta } = await ReturnService.fetchReturns(
      query,
      limit,
      skip,
    );

    return new ApiResponse(
      res,
      HTTP_STATUS.OK,
      "Platform return queue fetched successfully.",
      { returns, meta },
    ).send();
  }

  /**
   * @route   PATCH /api/v1/returns/admin/:returnId/arbitrate
   * @desc    Approve or Reject a customer's return request
   * @access  Private (Admin Only)
   */
  public static async arbitrateReturn(req: Request, res: Response) {
    const returnId = String(req.params.returnId);
    const payload = req.body as ArbitrateReturnInput;

    // extract admin context for audit
    const auditContext = getAuditContext(req);

    const returnRequest = await ReturnService.arbitrateReturn(
      returnId,
      payload,
      auditContext,
    );

    return new ApiResponse(
      res,
      HTTP_STATUS.OK,
      `Return request successfully ${payload.status.toLowerCase()}.`,
      { returnRequest },
    ).send();
  }

  /**
   * @route   POST /api/v1/returns/admin/:returnId/process
   * @desc    Final Step: Issue Razorpay refund and atomically restock inventory
   * @access  Private (Admin Only)
   */
  public static async processRefund(req: Request, res: Response) {
    const returnId = String(req.params.returnId);
    const auditContext = getAuditContext(req);
    const returnRequest = await ReturnService.processRefundAndRestock(
      returnId,
      auditContext,
    );

    return new ApiResponse(
      res,
      HTTP_STATUS.OK,
      "Refund processed successfully and inventory has been restocked.",
      { returnRequest },
    ).send();
  }
}

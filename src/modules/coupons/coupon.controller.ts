import { Request, Response, NextFunction } from "express";
import { HTTP_STATUS } from "@shared/constant/http-codes";
import { ApiResponse } from "@shared/utils/api-response";
import { CouponService } from "./coupon.service";

/**
 * PRODUCTION-GRADE WRAPPER
 */
const catchAsync = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
};

export class CouponController {
  /**
   * @route   GET /api/v1/coupons/available
   * @access  Private (Logged in users)
   */
  public static getAvailableCoupons = catchAsync(
    async (req: Request, res: Response) => {
      const rawCartValue = req.query.cartValue;
      const cartValue =
        rawCartValue && !isNaN(Number(rawCartValue))
          ? Number(rawCartValue)
          : undefined;

      const coupons = await CouponService.getAvailableCoupons(cartValue);

      return new ApiResponse(
        res,
        HTTP_STATUS.OK,
        "Available promotional codes fetched successfully.",
        { coupons },
      ).send();
    },
  );

  /**
   * @route   POST /api/v1/coupons
   * @access  Private (Admin Only)
   */
  public static createCoupon = catchAsync(
    async (req: Request, res: Response) => {
      const coupon = await CouponService.createCoupon(req.body);
      return new ApiResponse(
        res,
        HTTP_STATUS.CREATED,
        "Promotional code successfully generated and active.",
        coupon,
      ).send();
    },
  );

  /**
   * @route   PATCH /api/v1/coupons/:id
   * @access  Private (Admin Only)
   */
  public static updateCoupon = catchAsync(
    async (req: Request, res: Response) => {
      const id = String(req.params.id);
      const coupon = await CouponService.updateCoupon(id, req.body);
      return new ApiResponse(
        res,
        HTTP_STATUS.OK,
        "Promotional code parameters successfully updated.",
        coupon,
      ).send();
    },
  );

  /**
   * @route   GET /api/v1/coupons
   * @access  Private (Admin Only)
   */
  public static getCoupons = catchAsync(async (req: Request, res: Response) => {
    const limit = Math.max(1, parseInt(String(req.query.limit), 10) || 10);
    const skip = Math.max(0, parseInt(String(req.query.skip), 10) || 0);

    const filter: Record<string, unknown> = {};

    // SECURITY: Wrapped all dynamic filters in $eq to prevent NoSQL Operator Injection
    if (typeof req.query.code === "string") {
      filter.code = {
        $eq: req.query.code.toUpperCase().replace(/[\r\n]/g, ""),
      };
    }
    if (typeof req.query.isActive === "string") {
      filter.isActive = { $eq: req.query.isActive === "true" };
    }
    if (typeof req.query.discountType === "string") {
      filter.discountType = {
        $eq: String(req.query.discountType).toUpperCase(),
      };
    }
    if (typeof req.query.isFirstOrderOnly === "string") {
      filter.isFirstOrderOnly = { $eq: req.query.isFirstOrderOnly === "true" };
    }

    const result = await CouponService.fetchCoupons(filter, limit, skip);

    return new ApiResponse(
      res,
      HTTP_STATUS.OK,
      "Coupons retrieved successfully.",
      result,
    ).send();
  });
}

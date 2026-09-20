// ──────────────────────────────────────────────
// CouponService Unit Tests
// ──────────────────────────────────────────────

jest.mock("@modules/coupons/coupon.model", () => ({
  CouponModel: {
    findOne: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    findOneAndUpdate: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
  },
}));

jest.mock("@modules/orders/order.model", () => ({
  Order: {
    countDocuments: jest.fn(),
  },
}));

import { Types } from "mongoose";
import { CouponService } from "@modules/coupons/coupon.service";
import { CouponModel } from "@modules/coupons/coupon.model";
import { Order } from "@modules/orders/order.model";
import {
  DiscountType,
  PaymentRestriction,
} from "@modules/coupons/interfaces/coupon.interface";
import { buildCoupon } from "@tests/factories/coupon.factory";
import { AppError } from "@shared/utils/app-error";

const mockCoupon = CouponModel as unknown as {
  findOne: jest.Mock;
  findById: jest.Mock;
  create: jest.Mock;
  findOneAndUpdate: jest.Mock;
  find: jest.Mock;
  countDocuments: jest.Mock;
};

const mockOrder = Order as unknown as { countDocuments: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── chainable helper ───
function chainable<T>(value: T) {
  return {
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(value),
    then: (resolve: (v: T) => unknown) => Promise.resolve(value).then(resolve),
  };
}

// ═══════════════════════════════════════════════
// createCoupon
// ═══════════════════════════════════════════════
describe("CouponService.createCoupon", () => {
  const validPayload = {
    code: "DIWALI20",
    discountType: DiscountType.PERCENTAGE,
    discountValue: 20,
    maxDiscountAmount: 500,
    minCartValue: 1000,
    startDate: new Date(),
    expiryDate: new Date(Date.now() + 86400000),
    usageLimit: 100,
    isActive: true,
    isFirstOrderOnly: false,
    paymentMethodRestriction: PaymentRestriction.ANY,
  };

  it("uppercases and sanitizes the code before creating", async () => {
    mockCoupon.findOne.mockReturnValue(chainable(null));
    mockCoupon.create.mockImplementation(
      async (data: Record<string, unknown>) => ({
        _id: new Types.ObjectId(),
        ...data,
      }),
    );

    const result = await CouponService.createCoupon({
      ...validPayload,
      code: "diwali20" as unknown as string,
    });

    expect(mockCoupon.create).toHaveBeenCalled();
    const createArg = mockCoupon.create.mock.calls[0][0];
    expect(createArg.code).toBe("DIWALI20");
    expect(result).toBeDefined();
  });

  it("strips CRLF from the code before logging/creating (log injection defense)", async () => {
    mockCoupon.findOne.mockReturnValue(chainable(null));
    mockCoupon.create.mockImplementation(
      async (data: Record<string, unknown>) => ({
        _id: new Types.ObjectId(),
        ...data,
      }),
    );

    await CouponService.createCoupon({
      ...validPayload,
      code: "EVIL\r\nINJECT" as unknown as string,
    });

    const createArg = mockCoupon.create.mock.calls[0][0];
    expect(createArg.code).not.toContain("\r");
    expect(createArg.code).not.toContain("\n");
  });

  it("throws 409 when the code already exists", async () => {
    mockCoupon.findOne.mockReturnValue(
      chainable(buildCoupon({ code: "DIWALI20" })),
    );

    await expect(
      CouponService.createCoupon(validPayload),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("strips undefined fields before passing to Mongoose", async () => {
    mockCoupon.findOne.mockReturnValue(chainable(null));
    mockCoupon.create.mockImplementation(
      async (data: Record<string, unknown>) => ({
        _id: new Types.ObjectId(),
        ...data,
      }),
    );

    await CouponService.createCoupon({
      ...validPayload,
      maxDiscountAmount: undefined,
    });

    const createArg = mockCoupon.create.mock.calls[0][0];
    expect(createArg).not.toHaveProperty("maxDiscountAmount");
  });
});

// ═══════════════════════════════════════════════
// updateCoupon
// ═══════════════════════════════════════════════
describe("CouponService.updateCoupon", () => {
  it("updates a coupon and returns the new document", async () => {
    const id = new Types.ObjectId().toString();
    const updated = buildCoupon({ code: "NEWCODE" });
    mockCoupon.findOneAndUpdate.mockResolvedValue(updated);

    const result = await CouponService.updateCoupon(id, { isActive: false });

    expect(result).toBe(updated);
    expect(mockCoupon.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: { $eq: id } },
      { $set: { isActive: false } },
      { new: true, runValidators: true },
    );
  });

  it("throws 404 when the coupon does not exist", async () => {
    mockCoupon.findOneAndUpdate.mockResolvedValue(null);

    await expect(
      CouponService.updateCoupon(new Types.ObjectId().toString(), {
        isActive: false,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ═══════════════════════════════════════════════
// validateAndCalculateDiscount
// ═══════════════════════════════════════════════
describe("CouponService.validateAndCalculateDiscount", () => {
  const userId = new Types.ObjectId().toString();

  it("throws 404 when the coupon does not exist", async () => {
    mockCoupon.findOne.mockResolvedValue(null);

    await expect(
      CouponService.validateAndCalculateDiscount("GHOST", 1000, userId),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("throws 400 when the coupon has not started yet", async () => {
    const future = new Date(Date.now() + 5 * 86400000);
    mockCoupon.findOne.mockResolvedValue(
      buildCoupon({
        startDate: future,
        expiryDate: new Date(Date.now() + 10 * 86400000),
      }),
    );

    await expect(
      CouponService.validateAndCalculateDiscount("FUTURE", 1000, userId),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when the coupon has expired", async () => {
    const past = new Date(Date.now() - 86400000);
    mockCoupon.findOne.mockResolvedValue(
      buildCoupon({
        startDate: new Date(Date.now() - 10 * 86400000),
        expiryDate: past,
      }),
    );

    await expect(
      CouponService.validateAndCalculateDiscount("EXPIRED", 1000, userId),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when the usage limit is exhausted", async () => {
    mockCoupon.findOne.mockResolvedValue(
      buildCoupon({ usageLimit: 10, usedCount: 10 }),
    );

    await expect(
      CouponService.validateAndCalculateDiscount("MAXED", 1000, userId),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when subtotal is below minCartValue", async () => {
    mockCoupon.findOne.mockResolvedValue(buildCoupon({ minCartValue: 5000 }));

    await expect(
      CouponService.validateAndCalculateDiscount("MINBUY", 1000, userId),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when first-order-only coupon is used by a returning customer", async () => {
    mockCoupon.findOne.mockResolvedValue(
      buildCoupon({ isFirstOrderOnly: true }),
    );
    mockOrder.countDocuments.mockResolvedValue(3);

    await expect(
      CouponService.validateAndCalculateDiscount("FIRSTONLY", 1000, userId),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("allows first-order coupon for a brand new customer", async () => {
    mockCoupon.findOne.mockResolvedValue(
      buildCoupon({
        code: "NEWUSER",
        discountType: DiscountType.FLAT,
        discountValue: 100,
        isFirstOrderOnly: true,
      }),
    );
    mockOrder.countDocuments.mockResolvedValue(0);

    const result = await CouponService.validateAndCalculateDiscount(
      "NEWUSER",
      1000,
      userId,
    );
    expect(result.discountAmount).toBe(100);
  });

  it("throws 400 when payment method restriction is violated", async () => {
    mockCoupon.findOne.mockResolvedValue(
      buildCoupon({ paymentMethodRestriction: PaymentRestriction.COD }),
    );

    await expect(
      CouponService.validateAndCalculateDiscount(
        "CODONLY",
        1000,
        userId,
        "PREPAID",
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("computes FLAT discount correctly", async () => {
    mockCoupon.findOne.mockResolvedValue(
      buildCoupon({
        discountType: DiscountType.FLAT,
        discountValue: 150,
      }),
    );

    const result = await CouponService.validateAndCalculateDiscount(
      "FLAT150",
      1000,
      userId,
    );
    expect(result.discountAmount).toBe(150);
  });

  it("caps FLAT discount at the subtotal (never negative)", async () => {
    mockCoupon.findOne.mockResolvedValue(
      buildCoupon({ discountType: DiscountType.FLAT, discountValue: 2000 }),
    );

    const result = await CouponService.validateAndCalculateDiscount(
      "BIGFLAT",
      1000,
      userId,
    );
    expect(result.discountAmount).toBe(1000);
  });

  it("computes PERCENTAGE discount correctly", async () => {
    mockCoupon.findOne.mockResolvedValue(
      buildCoupon({
        discountType: DiscountType.PERCENTAGE,
        discountValue: 20,
        maxDiscountAmount: 500,
      }),
    );

    const result = await CouponService.validateAndCalculateDiscount(
      "PCT20",
      1000,
      userId,
    );
    expect(result.discountAmount).toBe(200);
  });

  it("caps PERCENTAGE discount at maxDiscountAmount", async () => {
    mockCoupon.findOne.mockResolvedValue(
      buildCoupon({
        discountType: DiscountType.PERCENTAGE,
        discountValue: 50,
        maxDiscountAmount: 300,
      }),
    );

    const result = await CouponService.validateAndCalculateDiscount(
      "PCT50",
      2000,
      userId,
    );
    // 50% of 2000 = 1000, but capped at 300
    expect(result.discountAmount).toBe(300);
  });

  it("rounds PERCENTAGE discounts to 2 decimals", async () => {
    mockCoupon.findOne.mockResolvedValue(
      buildCoupon({
        discountType: DiscountType.PERCENTAGE,
        discountValue: 15,
        maxDiscountAmount: 5000,
      }),
    );

    const result = await CouponService.validateAndCalculateDiscount(
      "PCT15",
      333.33,
      userId,
    );
    // 15% of 333.33 = 49.9995 -> 50
    expect(result.discountAmount).toBe(50);
  });

  it("uppercases and sanitizes the code before querying", async () => {
    mockCoupon.findOne.mockResolvedValue(
      buildCoupon({ discountType: DiscountType.FLAT, discountValue: 50 }),
    );

    await CouponService.validateAndCalculateDiscount(
      "lowercase\r\n",
      500,
      userId,
    );

    const query = mockCoupon.findOne.mock.calls[0][0];
    // Service uppercases and strips CRLF, but does NOT trim whitespace
    expect(query.code.$eq).toBe("LOWERCASE");
  });

  it("returns couponId and discountAmount", async () => {
    const coupon = buildCoupon({
      discountType: DiscountType.FLAT,
      discountValue: 100,
    });
    mockCoupon.findOne.mockResolvedValue(coupon);

    const result = await CouponService.validateAndCalculateDiscount(
      coupon.code,
      500,
      userId,
    );

    expect(result.couponId.toString()).toBe(coupon._id.toString());
    expect(result.discountAmount).toBe(100);
  });
});

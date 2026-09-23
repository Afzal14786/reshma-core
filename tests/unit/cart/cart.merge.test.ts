// ──────────────────────────────────────────────
// CartService — merge & signature logic unit tests
// Focuses on pure functions and merge behavior.
// DB interactions are mocked.
// ──────────────────────────────────────────────

jest.mock("@config/redis", () => ({
  redisClient: {
    get: jest.fn(),
    set: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
    flushdb: jest.fn(),
    quit: jest.fn(),
    isOpen: true,
  },
  connectRedis: jest.fn(),
}));

jest.mock("@modules/cart/cart.model", () => ({
  Cart: {
    findOne: jest.fn(),
    create: jest.fn(),
    findOneAndUpdate: jest.fn(),
    deleteOne: jest.fn(),
  },
}));

// Mock the BARREL — not the base file.
// cart.service.ts imports Product from '@modules/products/models',
// and that barrel triggers side-effect discriminator registrations
// (bangle.model, apparel.model, etc.) which crash on a bare mock.
// Mocking the barrel path intercepts before any of that runs.
jest.mock("@modules/products/models", () => ({
  Product: {
    findOne: jest.fn(),
    bulkWrite: jest.fn(),
  },
}));

jest.mock("@modules/coupons/coupon.model", () => ({
  CouponModel: {
    findById: jest.fn(),
    findOne: jest.fn(),
  },
}));

jest.mock("@modules/coupons/coupon.service", () => ({
  CouponService: {
    validateAndCalculateDiscount: jest.fn(),
  },
}));

jest.mock("mongoose", () => {
  const actual = jest.requireActual("mongoose");
  return {
    ...actual,
    startSession: jest.fn().mockResolvedValue({
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    }),
    Types: actual.Types,
  };
});

import { Types } from "mongoose";
import { CartService } from "@modules/cart/cart.service";

// ─── Access private methods via bracket notation ───
const generateItemSignature = (
  CartService as unknown as {
    generateItemSignature: (
      productId: string,
      attributes?: Record<string, string | number | boolean>,
    ) => string;
  }
).generateItemSignature.bind(CartService);

const reconstructAttributes = (
  CartService as unknown as {
    reconstructAttributes: (
      attributes?: Record<string, string | number | boolean>,
    ) => Record<string, string | number | boolean> | undefined;
  }
).reconstructAttributes.bind(CartService);

// ═══════════════════════════════════════════════
// generateItemSignature
// ═══════════════════════════════════════════════
describe("CartService.generateItemSignature", () => {
  const productId = "507f1f77bcf86cd799439011";

  it("returns just the product ID when no attributes are given", () => {
    expect(generateItemSignature(productId)).toBe(productId);
  });

  it("returns just the product ID for an empty attribute object", () => {
    expect(generateItemSignature(productId, {})).toBe(productId);
  });

  it("combines product ID and attributes with a pipe", () => {
    const sig = generateItemSignature(productId, { size: "XL" });
    expect(sig).toBe(`${productId}|size:XL`);
  });

  it("sorts attribute keys alphabetically (stable signatures)", () => {
    const a = generateItemSignature(productId, { z: "1", a: "2" });
    const b = generateItemSignature(productId, { a: "2", z: "1" });
    expect(a).toBe(b);
    expect(a).toBe(`${productId}|a:2|z:1`);
  });

  it("produces different signatures for different attribute values", () => {
    const red = generateItemSignature(productId, { color: "Red" });
    const blue = generateItemSignature(productId, { color: "Blue" });
    expect(red).not.toBe(blue);
  });

  it("produces different signatures for different keys", () => {
    const size = generateItemSignature(productId, { size: "XL" });
    const color = generateItemSignature(productId, { color: "XL" });
    expect(size).not.toBe(color);
  });

  it("handles numeric attribute values", () => {
    const sig = generateItemSignature(productId, { bangleSize: 2.4 });
    expect(sig).toBe(`${productId}|bangleSize:2.4`);
  });

  it("handles boolean attribute values", () => {
    const sig = generateItemSignature(productId, { giftWrap: true });
    expect(sig).toBe(`${productId}|giftWrap:true`);
  });

  it("handles mixed primitive types", () => {
    const sig = generateItemSignature(productId, {
      size: "XL",
      count: 3,
      premium: false,
    });
    expect(sig).toBe(`${productId}|count:3|premium:false|size:XL`);
  });
});

// ═══════════════════════════════════════════════
// reconstructAttributes
// ═══════════════════════════════════════════════
describe("CartService.reconstructAttributes", () => {
  it("returns undefined for undefined input", () => {
    expect(reconstructAttributes(undefined)).toBeUndefined();
  });

  it("returns a prototype-less object", () => {
    const result = reconstructAttributes({ size: "XL" });
    expect(result).toBeDefined();
    expect(Object.getPrototypeOf(result)).toBeNull();
  });

  it("copies safe keys and values", () => {
    const result = reconstructAttributes({ size: "XL", color: "Red" });
    expect(result).toEqual({ size: "XL", color: "Red" });
  });

  it("drops __proto__ key (prototype pollution defense)", () => {
    const result = reconstructAttributes({
      size: "XL",
      __proto__: "evil",
    } as Record<string, string>);
    expect(result).toEqual({ size: "XL" });
  });

  it("drops constructor key", () => {
    const result = reconstructAttributes({
      size: "XL",
      constructor: "evil",
    } as Record<string, string>);
    expect(result).toEqual({ size: "XL" });
  });

  it("drops prototype key", () => {
    const result = reconstructAttributes({
      size: "XL",
      prototype: "evil",
    } as Record<string, string>);
    expect(result).toEqual({ size: "XL" });
  });

  it("keeps numeric and boolean values", () => {
    const result = reconstructAttributes({ bangleSize: 2.4, gift: true });
    expect(result).toEqual({ bangleSize: 2.4, gift: true });
  });
});

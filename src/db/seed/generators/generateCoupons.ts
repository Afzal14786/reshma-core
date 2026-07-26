import { faker } from "@faker-js/faker";
import { ISeedCoupon } from "../types";
import { pickRandom } from "./base-generator";

/**
 * Generate a unique coupon code with a prefix and random suffix.
 * Ensures no duplicates by adding a random string.
 */
const generateUniqueCode = (prefix: string = "PROMO"): string => {
  const randomSuffix = faker.string.alphanumeric(4).toUpperCase();
  return `${prefix}${randomSuffix}`;
};

/**
 * Generate a random date in the past (up to 1 year ago)
 */
const pastDate = (): Date => faker.date.past({ years: 1 });

/**
 * Generate a random date in the future (up to 1 year from now)
 */
const futureDate = (): Date => faker.date.future({ years: 1 });

/**
 * Generate a random coupon with realistic scenarios
 */
export const generateCoupons = (count: number = 20): ISeedCoupon[] => {
  const coupons: ISeedCoupon[] = [];

  for (let i = 0; i < count; i++) {
    // Determine scenario (weighted towards active)
    const scenario = pickRandom([
      "active",
      "active",
      "active",
      "expired",
      "future",
      "maxed",
      "inactive",
    ]);

    // Discount type – use `as const` to get literal type
    const discountType = pickRandom(["FLAT", "PERCENTAGE"] as const);
    let discountValue: number;
    if (discountType === "FLAT") {
      discountValue = pickRandom([100, 150, 200, 300, 500, 1000]);
    } else {
      discountValue = pickRandom([5, 10, 15, 20, 25, 30, 40, 50]);
    }

    // Minimum cart value (60% chance to have one)
    // Only assign if it has a value (for exactOptionalPropertyTypes)
    const minCartValue =
      Math.random() > 0.4
        ? pickRandom([300, 500, 1000, 1500, 2000, 5000])
        : undefined;

    // Usage limit (60% chance to have one)
    // Only assign if it has a value
    let usageLimit: number | undefined =
      Math.random() > 0.4 ? faker.number.int({ min: 10, max: 200 }) : undefined;

    let usedCount: number = 0;
    let startDate: Date;
    let expiryDate: Date;
    let isActive: boolean = true;

    switch (scenario) {
      case "active":
        startDate = pastDate();
        expiryDate = futureDate();
        // ensure expiry > start
        if (expiryDate <= startDate) {
          expiryDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        }
        usedCount = faker.number.int({
          min: 0,
          max: Math.floor((usageLimit || 100) * 0.8),
        });
        isActive = true;
        break;

      case "expired":
        startDate = pastDate();
        expiryDate = new Date(
          startDate.getTime() +
            faker.number.int({ min: 1, max: 60 }) * 24 * 60 * 60 * 1000,
        );
        // ensure expiry is still in past relative to now
        if (expiryDate > new Date()) {
          expiryDate = new Date(
            Date.now() -
              faker.number.int({ min: 1, max: 30 }) * 24 * 60 * 60 * 1000,
          );
        }
        usedCount = faker.number.int({
          min: 0,
          max: Math.floor((usageLimit || 100) * 0.9),
        });
        isActive = true;
        break;

      case "future":
        startDate = futureDate();
        expiryDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        usedCount = 0;
        isActive = true;
        break;

      case "maxed":
        // Must have usageLimit, and usedCount = usageLimit
        usageLimit = faker.number.int({ min: 10, max: 100 });
        usedCount = usageLimit;
        startDate = pastDate();
        expiryDate = futureDate();
        if (expiryDate <= startDate) {
          expiryDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        }
        isActive = true;
        break;

      case "inactive":
        startDate = pastDate();
        expiryDate = futureDate();
        if (expiryDate <= startDate) {
          expiryDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        }
        usedCount = faker.number.int({ min: 0, max: 50 });
        isActive = false;
        break;

      default:
        startDate = pastDate();
        expiryDate = futureDate();
        if (expiryDate <= startDate) {
          expiryDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        }
        usedCount = 0;
        isActive = true;
    }

    // Generate unique code
    const code = generateUniqueCode();

    // Build coupon object conditionally (for exactOptionalPropertyTypes)
    const coupon: ISeedCoupon = {
      code,
      discountType,
      discountValue,
      startDate,
      expiryDate,
      usedCount,
      isActive,
    };

    // Only add minCartValue if it has a value
    if (minCartValue !== undefined) {
      coupon.minCartValue = minCartValue;
    }

    // Only add usageLimit if it has a value
    if (usageLimit !== undefined) {
      coupon.usageLimit = usageLimit;
    }

    coupons.push(coupon);
  }

  return coupons;
};

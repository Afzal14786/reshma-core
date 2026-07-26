import { CouponModel } from "@modules/coupons/coupon.model";
import { ISeedCoupon } from "../types";
import { generateCoupons } from "../generators/generateCoupons";
import staticCouponsData from "../data/coupons/static-coupons.json";

/**
 * Seed coupons: static + dynamic
 * @param clearExisting - Whether to delete all existing coupons before seeding.
 */
export const seedCoupons = async (
  clearExisting: boolean = false,
): Promise<void> => {
  console.log("🏷️ Seeding coupons...");

  if (clearExisting) {
    await CouponModel.deleteMany({});
    console.log("🧹 Cleared existing coupons.");
  }

  // 1. Seed static coupons (upsert by code)
  const staticCoupons: ISeedCoupon[] = staticCouponsData as ISeedCoupon[];
  for (const coupon of staticCoupons) {
    await CouponModel.updateOne(
      { code: coupon.code },
      { $set: coupon },
      { upsert: true },
    );
  }
  console.log(`✅ Upserted ${staticCoupons.length} static coupons.`);

  // 2. Generate dynamic coupons (20-30 coupons with varied scenarios)
  const dynamicCoupons = generateCoupons(30);
  // Filter out any that might have duplicate codes with static ones (low probability, but safe)
  const existingCodes = staticCoupons.map((c) => c.code);
  const uniqueDynamic = dynamicCoupons.filter(
    (c) => !existingCodes.includes(c.code),
  );

  if (uniqueDynamic.length > 0) {
    await CouponModel.insertMany(uniqueDynamic, { ordered: false });
    console.log(`✅ Seeded ${uniqueDynamic.length} dynamic coupons.`);
  } else {
    console.log("⚠️ No new dynamic coupons to seed (all duplicates).");
  }

  const total = await CouponModel.countDocuments();
  console.log(`📊 Total coupons now: ${total}`);
};

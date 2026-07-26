import { Order } from "@modules/orders/order.model";
import { CouponModel } from "@modules/coupons/coupon.model";
import { generateOrders } from "../generators/generateOrders";

/**
 * Seed orders into the database.
 * Also updates coupon usage counts for orders that used a coupon.
 */
export const seedOrders = async (orderCount: number = 100): Promise<void> => {
  console.log("📦 Seeding orders...");

  const orders = await generateOrders(orderCount);

  if (orders.length === 0) {
    console.log("⚠️ No orders generated.");
    return;
  }

  // Insert orders
  const insertedOrders = await Order.insertMany(orders, { ordered: false });
  console.log(`✅ Inserted ${insertedOrders.length} orders.`);

  // ---- Update coupon usage counts ----
  // Group orders by coupon ID (only those with an applied coupon)
  const couponUsage: Record<string, number> = {};
  for (const order of insertedOrders) {
    // The coupon is stored inside pricing.appliedCoupon
    if (order.pricing && order.pricing.appliedCoupon) {
      const key = order.pricing.appliedCoupon.toString();
      couponUsage[key] = (couponUsage[key] || 0) + 1;
    }
  }

  // Bulk update each coupon's usedCount
  for (const [couponId, count] of Object.entries(couponUsage)) {
    await CouponModel.updateOne(
      { _id: couponId },
      { $inc: { usedCount: count } },
    );
  }
  console.log(
    `✅ Updated ${Object.keys(couponUsage).length} coupons with usage counts.`,
  );

  // Log total orders
  const total = await Order.countDocuments();
  console.log(`📊 Total orders now: ${total}`);
};

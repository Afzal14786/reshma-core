import { Types } from "mongoose";
import { ReturnModel } from "@modules/returns/return.model";
import { Order } from "@modules/orders/order.model";
import { generateReturns } from "../generators/generateReturns";

/**
 * Seed returns and update associated orders.
 */
export const seedReturns = async (returnCount: number = 40): Promise<void> => {
  console.log("🔄 Seeding returns...");

  const returns = await generateReturns(returnCount);

  if (returns.length === 0) {
    console.log("⚠️ No returns generated.");
    return;
  }

  // Insert returns
  const insertedReturns = await ReturnModel.insertMany(returns, {
    ordered: false,
  });
  console.log(`✅ Inserted ${insertedReturns.length} returns.`);

  // ---- Update order status for APPROVED and COMPLETED returns ----
  const orderIdsToUpdate: Types.ObjectId[] = [];
  for (const ret of insertedReturns) {
    // Use string comparison to bypass enum mismatch
    const status = ret.status as string;
    if (status === "APPROVED" || status === "COMPLETED") {
      orderIdsToUpdate.push(ret.order);
    }
  }

  if (orderIdsToUpdate.length > 0) {
    await Order.updateMany(
      { _id: { $in: orderIdsToUpdate } },
      { $set: { orderStatus: "RETURNED" } },
    );
    console.log(
      `✅ Updated ${orderIdsToUpdate.length} orders to status 'RETURNED'.`,
    );
  }

  // Log total returns
  const total = await ReturnModel.countDocuments();
  console.log(`📊 Total returns now: ${total}`);
};

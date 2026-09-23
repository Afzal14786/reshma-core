import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import { Order } from "@modules/orders/order.model";
import { User } from "@modules/users/user.model";
import { createUserWithToken } from "./auth.helper";
import { createTestBangle } from "./product.helper";
import {
  buildOrderDoc,
  buildShippingAddress,
} from "@tests/factories/order.factory";
import { TaxProfile } from "@modules/orders/tax.utils";
import env from "@config/env";
import type { IUser } from "@modules/users/interfaces/user.interface";

const HSN_BY_PROFILE: Record<string, string> = {
  [TaxProfile.IMITATION_JEWELLERY]: "7117",
  [TaxProfile.LAC_JEWELLERY]: "7117",
  [TaxProfile.UNSTITCHED_FABRIC]: "5208",
  [TaxProfile.STITCHED_APPAREL]: "6204",
  [TaxProfile.GENERAL_ACCESSORY]: "4202",
  [TaxProfile.FOOTWEAR]: "6404",
};

/**
 * Resolves the owning user for a test order.
 *
 * If `accessToken` is provided, decode it and fetch the user from the DB
 * — this guarantees the order is created for the SAME user the test
 * will sign future requests as.
 *
 * If no token is provided, a fresh user + token are created.
 */
async function resolveOwner(opts: {
  user?: Types.ObjectId;
  accessToken?: string;
}): Promise<{ user: IUser; accessToken: string }> {
  if (opts.accessToken) {
    const decoded = jwt.verify(opts.accessToken, env.JWT_ACCESS_SECRET) as {
      id: string;
    };
    const user = await User.findById(decoded.id);
    if (!user) {
      throw new Error(
        "createTestOrder: accessToken refers to a user that no longer exists.",
      );
    }
    return { user, accessToken: opts.accessToken };
  }

  if (opts.user) {
    throw new Error(
      "createTestOrder: 'user' was passed without 'accessToken'. Pass both or neither.",
    );
  }

  const created = await createUserWithToken();
  return { user: created.user, accessToken: created.accessToken };
}

export async function createTestOrder(
  opts: {
    user?: Types.ObjectId;
    accessToken?: string;
    itemCount?: number;
    quantity?: number;
    state?: string;
    paymentMethod?: "RAZORPAY" | "COD";
    paymentStatus?: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
    orderStatus?:
      | "PENDING"
      | "PROCESSING"
      | "SHIPPED"
      | "DELIVERED"
      | "CANCELLED"
      | "RETURN_REQUESTED"
      | "RETURNED";
    gatewayOrderId?: string;
    gatewayPaymentId?: string;
    basePrice?: number;
  } = {},
) {
  const { user, accessToken } = await resolveOwner(opts);

  const product = await createTestBangle({
    basePrice: opts.basePrice ?? 1000,
    taxProfile: TaxProfile.IMITATION_JEWELLERY,
  });

  const itemCount = opts.itemCount ?? 1;
  const quantity = opts.quantity ?? 1;

  const items = Array.from({ length: itemCount }, () => ({
    product: product._id as Types.ObjectId,
    name: product.name,
    sku: product.sku,
    quantity,
    priceAtPurchase: product.basePrice,
    imageSnapshot: product.images[0]!,
    hsnCode: HSN_BY_PROFILE[product.taxProfile] ?? "7117",
    gstRate: 3,
  }));

  const doc = buildOrderDoc({
    user: user._id as Types.ObjectId,
    items,
    shippingAddress: { state: opts.state ?? "WB" },
    paymentMethod: opts.paymentMethod ?? "RAZORPAY",
    paymentStatus: opts.paymentStatus ?? "PENDING",
    orderStatus: opts.orderStatus ?? "PENDING",
    ...(opts.gatewayOrderId ? { gatewayOrderId: opts.gatewayOrderId } : {}),
    ...(opts.gatewayPaymentId ? { gatewayPaymentId: opts.gatewayPaymentId } : {}),
  });

  const order = await Order.create(doc);
  return { order, user, accessToken, product };
}

export async function createDeliveredOrder(
  opts: Parameters<typeof createTestOrder>[0] = {},
) {
  return createTestOrder({
    ...opts,
    paymentStatus: "PAID",
    orderStatus: "DELIVERED",
  });
}

export { buildShippingAddress };
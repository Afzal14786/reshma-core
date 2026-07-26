import { faker } from "@faker-js/faker";
import { Types } from "mongoose";
import crypto from "crypto";
import mongoose from "mongoose";
import { Order } from "@modules/orders/order.model";
import { Product } from "@modules/products/models/base-product.model";
import { pickRandom } from "./base-generator";

// Register a temporary model named "BaseProduct" to satisfy the populate ref
if (!mongoose.models.BaseProduct) {
  mongoose.model("BaseProduct", Product.schema, "products");
}

// ---- Interfaces matching the Return schema ----
interface IReturnItemInput {
  product: Types.ObjectId;
  quantity: number;
  reason: "DEFECTIVE" | "WRONG_ITEM" | "SIZE_ISSUE" | "NOT_LIKED";
  customerNote?: string;
}

interface IGeneratedReturn {
  returnNumber: string;
  order: Types.ObjectId;
  user: Types.ObjectId;
  items: IReturnItemInput[];
  images?: string[];
  status: "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED";
  refundAmount?: number;
  adminNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Generate a unique return number: RET-XXXXX (hex)
 */
const generateReturnNumber = (): string => {
  const randomHex = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `RET-${randomHex}`;
};

/**
 * Generate a random image URL (mock) for fragile item proof
 */
const generateReturnImage = (): string => {
  return faker.image.url({ width: 800, height: 600 });
};

/**
 * Main generator: fetches delivered orders and creates return requests.
 */
export const generateReturns = async (
  returnCount: number = 40,
): Promise<IGeneratedReturn[]> => {
  // ---- Fetch delivered orders that have at least one returnable item ----
  const deliveredOrders = await Order.find({
    orderStatus: "DELIVERED",
  })
    .populate("items.product") // now works because "BaseProduct" is registered
    .lean();

  if (deliveredOrders.length === 0) {
    console.warn("No delivered orders found; cannot generate returns.");
    return [];
  }

  const returns: IGeneratedReturn[] = [];

  // We'll randomly pick orders to create returns, up to returnCount
  const orderPool = faker.helpers.shuffle(deliveredOrders);
  const selectedOrders = orderPool.slice(0, returnCount);

  for (const order of selectedOrders) {
    // ---- Filter returnable items (exclude INNERWEAR) ----
    const returnableItems = order.items.filter(
      (item: any) => item.product && item.product.itemType !== "INNERWEAR",
    );

    if (returnableItems.length === 0) continue;

    // ---- Pick 1-2 items to return ----
    const itemsToReturnCount = faker.number.int({
      min: 1,
      max: Math.min(2, returnableItems.length),
    });
    const selectedItems = faker.helpers.arrayElements(
      returnableItems,
      itemsToReturnCount,
    );

    const returnItems: IReturnItemInput[] = [];
    let refundProportion = 0;
    let orderSubtotal = order.pricing.subTotal;

    for (const item of selectedItems) {
      // Determine quantity to return (could be less than or equal to ordered quantity)
      const maxQty = item.quantity;
      const returnQty = faker.number.int({ min: 1, max: maxQty });

      // Proportion of subtotal for this item
      const itemSubtotal = item.priceAtPurchase * returnQty;
      refundProportion += itemSubtotal / orderSubtotal;

      returnItems.push({
        product: item.product._id,
        quantity: returnQty,
        reason: pickRandom([
          "DEFECTIVE",
          "WRONG_ITEM",
          "SIZE_ISSUE",
          "NOT_LIKED",
        ]),
        customerNote: faker.lorem.sentence({ min: 3, max: 10 }),
      });
    }

    // ---- Determine return status ----
    const statusRoll = Math.random();
    let status: IGeneratedReturn["status"];
    let refundAmount: number | undefined;
    let adminNote: string | undefined;
    let images: string[] | undefined;

    // Check if any return item is from a fragile product; if yes, add images
    const hasFragile = selectedItems.some(
      (item: any) => item.product?.isFragile === true,
    );
    if (hasFragile) {
      images = [generateReturnImage(), generateReturnImage()];
    }

    if (statusRoll < 0.4) {
      status = "PENDING";
    } else if (statusRoll < 0.7) {
      status = "APPROVED";
      const totalAmount = order.pricing.totalAmount;
      refundAmount = Math.round(totalAmount * refundProportion * 100) / 100;
    } else if (statusRoll < 0.9) {
      status = "REJECTED";
      adminNote = faker.lorem.sentence({ min: 5, max: 15 });
    } else {
      status = "COMPLETED";
      const totalAmount = order.pricing.totalAmount;
      refundAmount = Math.round(totalAmount * refundProportion * 100) / 100;
    }

    const returnNumber = generateReturnNumber();
    const now = new Date();

    const returnDoc: IGeneratedReturn = {
      returnNumber,
      order: order._id,
      user: order.user,
      items: returnItems,
      status,
      createdAt: now,
      updatedAt: now,
    };

    if (images && images.length > 0) returnDoc.images = images;
    if (refundAmount !== undefined) returnDoc.refundAmount = refundAmount;
    if (adminNote) returnDoc.adminNote = adminNote;

    returns.push(returnDoc);
  }

  return returns;
};

import { faker } from "@faker-js/faker";
import { Types } from "mongoose";
import { User } from "@modules/users/user.model";
import { Product } from "@modules/products/models";
import { CouponModel } from "@modules/coupons/coupon.model";
import { pickRandom } from "./base-generator";
import {
  IOrderItemInput,
  IShippingAddressInput,
  IGeneratedOrder,
} from "../types";
import crypto from "crypto";

/**
 * Generate a unique order number: ORD-XXXXX (hex)
 */
const generateOrderNumber = (): string => {
  const randomHex = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `ORD-${randomHex}`;
};

/**
 * Generate a random AWB number (mock)
 */
const generateTrackingNumber = (): string => {
  return `SHIP-${faker.string.alphanumeric(8).toUpperCase()}`;
};

/**
 * Calculate GST split (CGST+SGST for intra-state, IGST for inter-state)
 */
const calculateTaxDetails = (
  taxableAmount: number,
  gstRate: number = 18,
): { totalTax: number; cgst: number; sgst: number; igst: number } => {
  const isIntraState = Math.random() > 0.5;
  const totalTax = (taxableAmount * gstRate) / 100;
  let cgst = 0,
    sgst = 0,
    igst = 0;
  if (isIntraState) {
    cgst = totalTax / 2;
    sgst = totalTax / 2;
  } else {
    igst = totalTax;
  }
  return {
    totalTax: Math.round(totalTax * 100) / 100,
    cgst: Math.round(cgst * 100) / 100,
    sgst: Math.round(sgst * 100) / 100,
    igst: Math.round(igst * 100) / 100,
  };
};

/**
 * Generate a random HSN code (4-6 digits)
 */
const generateHsnCode = (): string => {
  return faker.string.numeric({ length: { min: 4, max: 6 } });
};

/**
 * Generate a random shipping charge (₹50–150, multiple of 10)
 */
const generateShippingCharge = (): number => {
  return Math.round((Math.random() * 100 + 50) / 10) * 10;
};

/**
 * Main generator: fetches users, products, coupons and builds orders.
 */
export const generateOrders = async (
  orderCount: number = 100,
): Promise<IGeneratedOrder[]> => {
  // ---- Fetch required data from DB ----
  const users = await User.find()
    .select("_id firstname lastname phone email addresses")
    .lean();
  const products = await Product.find()
    .select("_id name sku basePrice discount images isActive")
    .lean();
  const activeCoupons = await CouponModel.find({
    isActive: true,
    startDate: { $lte: new Date() },
    expiryDate: { $gte: new Date() },
    $expr: { $lt: ["$usedCount", "$usageLimit"] },
  }).lean();

  if (users.length === 0 || products.length === 0) {
    throw new Error(
      "Cannot generate orders: no users or products found in the database.",
    );
  }

  const orders: IGeneratedOrder[] = [];

  for (let i = 0; i < orderCount; i++) {
    // ---- Pick a random user ----
    const user = pickRandom(users);
    const userAddresses = user.addresses || [];

    // Extract a shipping address (map to schema)
    let selectedAddress =
      userAddresses.find((addr: any) => addr.isDefault) || userAddresses[0];
    let shippingAddress: IShippingAddressInput;
    if (selectedAddress) {
      shippingAddress = {
        fullName: `${user.firstname} ${user.lastname}`,
        phone: user.phone || "9999999999",
        streetAddress: selectedAddress.street,
        city: selectedAddress.city,
        state: selectedAddress.state,
        postalCode: selectedAddress.pincode,
        country: "India",
      };
    } else {
      // Fallback
      shippingAddress = {
        fullName: `${user.firstname} ${user.lastname}`,
        phone: user.phone || "9999999999",
        streetAddress: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state(),
        postalCode: faker.location.zipCode("######"),
        country: "India",
      };
    }

    // ---- Pick 1-5 random products ----
    const itemCount = faker.number.int({ min: 1, max: 5 });
    const selectedProducts = faker.helpers.arrayElements(products, itemCount);
    const items: IOrderItemInput[] = [];
    let subTotal = 0;

    for (const product of selectedProducts) {
      const quantity = faker.number.int({ min: 1, max: 3 });
      const priceAfterProductDiscount =
        product.basePrice * (1 - (product.discount || 0) / 100);
      const priceAtPurchase = Math.round(priceAfterProductDiscount * 100) / 100;

      const taxableValue = priceAtPurchase * quantity;
      const gstRate = 18;
      const taxDetails = calculateTaxDetails(taxableValue, gstRate);

      items.push({
        product: product._id,
        name: product.name,
        sku: product.sku,
        quantity,
        priceAtPurchase,
        selectedAttributes: {
          size: pickRandom(["S", "M", "L", "XL"]),
          color: pickRandom(["Red", "Blue", "Green", "Black", "White"]),
        },
        // Guarantee a string; use optional chaining and nullish coalescing
        imageSnapshot: product.images?.[0] ?? "",
        hsnCode: generateHsnCode(),
        taxableValue: Math.round(taxableValue * 100) / 100,
        gstRate,
        cgst: taxDetails.cgst,
        sgst: taxDetails.sgst,
        igst: taxDetails.igst,
      });
      subTotal += taxableValue;
    }
    subTotal = Math.round(subTotal * 100) / 100;

    // ---- Coupon application (30% chance) ----
    let appliedCoupon: Types.ObjectId | undefined = undefined;
    let discountAmount = 0;
    if (activeCoupons.length > 0 && Math.random() < 0.3) {
      const coupon = pickRandom(activeCoupons);
      if (!coupon.minCartValue || subTotal >= coupon.minCartValue) {
        appliedCoupon = coupon._id;
        if (coupon.discountType === "PERCENTAGE") {
          discountAmount = (subTotal * coupon.discountValue) / 100;
        } else {
          discountAmount = coupon.discountValue;
        }
        discountAmount = Math.min(discountAmount, subTotal);
        discountAmount = Math.round(discountAmount * 100) / 100;
      }
    }

    // ---- Calculate totals ----
    const taxableAfterDiscount = subTotal - discountAmount;
    const totalTaxDetails = calculateTaxDetails(taxableAfterDiscount, 18);
    const shippingCost = generateShippingCharge();
    const shippingTax = (shippingCost * 18) / 100;
    const totalAmount =
      taxableAfterDiscount +
      totalTaxDetails.totalTax +
      shippingCost +
      shippingTax;

    // ---- Determine order status and payment status ----
    const statusRoll = Math.random();
    let orderStatus: IGeneratedOrder["orderStatus"];
    let paymentStatus: IGeneratedOrder["paymentStatus"];
    let deliveredAt: Date | undefined;
    let cancelledAt: Date | undefined;
    let trackingNumber: string | undefined;
    let courierName: string | undefined;

    if (statusRoll < 0.3) {
      orderStatus = "DELIVERED";
      paymentStatus = "PAID";
      deliveredAt = faker.date.past({ years: 0.3 });
      trackingNumber = generateTrackingNumber();
      courierName = pickRandom([
        "Blue Dart",
        "DTDC",
        "Delhivery",
        "Shiprocket",
      ]);
    } else if (statusRoll < 0.5) {
      orderStatus = "SHIPPED";
      paymentStatus = "PAID";
      trackingNumber = generateTrackingNumber();
      courierName = pickRandom([
        "Blue Dart",
        "DTDC",
        "Delhivery",
        "Shiprocket",
      ]);
    } else if (statusRoll < 0.7) {
      orderStatus = "PROCESSING";
      paymentStatus = "PAID";
    } else if (statusRoll < 0.8) {
      orderStatus = "PENDING";
      paymentStatus = "PENDING";
    } else if (statusRoll < 0.9) {
      orderStatus = "CANCELLED";
      paymentStatus = "FAILED";
      cancelledAt = faker.date.past({ years: 0.1 });
    } else {
      orderStatus = "RETURN_REQUESTED";
      paymentStatus = "PAID";
      deliveredAt = faker.date.past({ years: 0.2 });
    }

    // ---- Generate gateway IDs for PAID orders ----
    let gatewayOrderId: string | undefined;
    let gatewayPaymentId: string | undefined;
    let gatewaySignature: string | undefined;
    if (paymentStatus === "PAID") {
      gatewayOrderId = `order_${faker.string.alphanumeric(14)}`;
      gatewayPaymentId = `pay_${faker.string.alphanumeric(14)}`;
      gatewaySignature = faker.string.alphanumeric(32);
    }

    // ---- Generate creation date (spread over last 90 days) ----
    const createdAt = faker.date.recent({ days: 90 });

    if (deliveredAt && deliveredAt < createdAt) {
      deliveredAt = new Date(
        createdAt.getTime() +
          faker.number.int({ min: 1, max: 10 }) * 24 * 60 * 60 * 1000,
      );
    }
    if (cancelledAt && cancelledAt < createdAt) {
      cancelledAt = new Date(
        createdAt.getTime() +
          faker.number.int({ min: 1, max: 5 }) * 24 * 60 * 60 * 1000,
      );
    }

    const orderNumber = generateOrderNumber();

    // ---- Build the order object with conditional optional fields ----
    const order: IGeneratedOrder = {
      user: user._id,
      orderNumber,
      items,
      shippingAddress,
      paymentMethod: "RAZORPAY",
      paymentStatus,
      orderStatus,
      createdAt,
      updatedAt: createdAt,
      pricing: {
        subTotal,
        discountAmount,
        totalTax: totalTaxDetails.totalTax,
        totalCgst: totalTaxDetails.cgst,
        totalSgst: totalTaxDetails.sgst,
        totalIgst: totalTaxDetails.igst,
        shippingCost,
        shippingTax: Math.round(shippingTax * 100) / 100,
        totalAmount: Math.round(totalAmount * 100) / 100,
        // We'll conditionally add appliedCoupon below
      },
    };

    // Conditionally add optional top-level fields
    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (courierName) order.courierName = courierName;
    if (gatewayOrderId) order.gatewayOrderId = gatewayOrderId;
    if (gatewayPaymentId) order.gatewayPaymentId = gatewayPaymentId;
    if (gatewaySignature) order.gatewaySignature = gatewaySignature;
    if (deliveredAt) order.deliveredAt = deliveredAt;
    if (cancelledAt) order.cancelledAt = cancelledAt;

    // Conditionally add appliedCoupon to pricing (satisfies exactOptionalPropertyTypes)
    if (appliedCoupon) {
      order.pricing.appliedCoupon = appliedCoupon;
    }

    orders.push(order);
  }

  return orders;
};

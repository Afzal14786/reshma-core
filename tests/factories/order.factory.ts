import { Types } from "mongoose";
import { IOrderShippingAddress } from "@modules/orders/interfaces/order.interface";

// ──────────────────────────────────────────────
// Shipping address builder
// ──────────────────────────────────────────────

export function buildShippingAddress(
  overrides: Partial<IOrderShippingAddress> = {},
): IOrderShippingAddress {
  return {
    fullName: "Test Buyer",
    phone: "+919876543210",
    streetAddress: "123 Test Street",
    city: "Kolkata",
    state: "WB",
    postalCode: "700001",
    country: "India",
    ...overrides,
  };
}

// ──────────────────────────────────────────────
// Order payload builder for direct DB insertion
// ──────────────────────────────────────────────

export interface OrderItemInput {
  product: Types.ObjectId;
  name: string;
  sku: string;
  quantity: number;
  priceAtPurchase: number;
  imageSnapshot: string;
  hsnCode: string;
  gstRate: number;
}

export interface OrderOverrides {
  user: Types.ObjectId;
  items: OrderItemInput[];
  shippingAddress?: Partial<IOrderShippingAddress>;
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
  trackingNumber?: string;
  courierName?: string;
}

export function buildOrderDoc(o: OrderOverrides) {
  const items = o.items.map((item) => {
    const taxableValue = item.priceAtPurchase * item.quantity;
    const totalTax = (taxableValue * item.gstRate) / 100;
    // Assume intra-state for the default WB address — 50/50 split
    const isIntraState = (o.shippingAddress?.state ?? "WB") === "WB";

    return {
      product: item.product,
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      priceAtPurchase: item.priceAtPurchase,
      imageSnapshot: item.imageSnapshot,
      hsnCode: item.hsnCode,
      taxableValue,
      gstRate: item.gstRate,
      cgst: isIntraState ? totalTax / 2 : 0,
      sgst: isIntraState ? totalTax / 2 : 0,
      igst: isIntraState ? 0 : totalTax,
    };
  });

  const subTotal = items.reduce((sum, i) => sum + i.taxableValue, 0);
  const totalTax = items.reduce(
    (sum, i) => sum + i.cgst + i.sgst + i.igst,
    0,
  );
  const shippingCost = subTotal > 2000 ? 0 : 100;
  const shippingTax = shippingCost / 1.18 * 0.18;
  const totalAmount = subTotal + totalTax + shippingCost;

  return {
    user: o.user,
    items,
    shippingAddress: buildShippingAddress(o.shippingAddress),
    pricing: {
      subTotal,
      discountAmount: 0,
      appliedCoupon: null,
      totalTax,
      totalCgst: items.reduce((sum, i) => sum + i.cgst, 0),
      totalSgst: items.reduce((sum, i) => sum + i.sgst, 0),
      totalIgst: items.reduce((sum, i) => sum + i.igst, 0),
      shippingCost,
      shippingTax: Number(shippingTax.toFixed(2)),
      totalAmount: Number(totalAmount.toFixed(2)),
    },
    paymentMethod: o.paymentMethod ?? "RAZORPAY",
    paymentStatus: o.paymentStatus ?? "PENDING",
    orderStatus: o.orderStatus ?? "PENDING",
    ...(o.gatewayOrderId ? { gatewayOrderId: o.gatewayOrderId } : {}),
    ...(o.gatewayPaymentId ? { gatewayPaymentId: o.gatewayPaymentId } : {}),
    ...(o.trackingNumber ? { trackingNumber: o.trackingNumber } : {}),
    ...(o.courierName ? { courierName: o.courierName } : {}),
  };
}
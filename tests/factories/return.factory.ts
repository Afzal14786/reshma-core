import { Types } from "mongoose";
import { ReturnReason } from "@modules/returns/interfaces/return.interface";

export interface ReturnItemInput {
  productId: string;
  quantity: number;
  reason: ReturnReason;
  customerNote?: string;
}

export function buildReturnItem(
  productId: string | Types.ObjectId,
  quantity = 1,
  reason: ReturnReason = ReturnReason.NOT_NEEDED,
  customerNote?: string,
): ReturnItemInput {
  const item: ReturnItemInput = {
    productId: String(productId),
    quantity,
    reason,
  };
  if (customerNote !== undefined) item.customerNote = customerNote;
  return item;
}

export function buildReturnPayload(
  items: ReturnItemInput[],
  images?: string[],
) {
  return {
    items,
    ...(images ? { images } : {}),
  };
}
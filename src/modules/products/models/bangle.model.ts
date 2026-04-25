import { Schema } from "mongoose";
import { Product } from "./base-product.model";
import { IBangleProduct } from "../interfaces";

export const Bangle = Product.discriminator<IBangleProduct>(
  "BANGLE",
  new Schema({
    bangleSizes: {
      type: [String],
      required: true,
      enum: ["2.2", "2.4", "2.6", "2.8"],
    },
    packSize: { type: Number, default: 12, min: 1 },
  }),
);

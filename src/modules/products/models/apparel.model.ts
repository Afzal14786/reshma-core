import { Schema } from "mongoose";
import { Product } from "./base-product.model";
import { IApparelProduct } from "../interfaces";

export const Apparel = Product.discriminator<IApparelProduct>(
  "APPAREL",
  new Schema({
    sizes: {
      type: [String],
      required: true,
      enum: [
        "XS",
        "S",
        "M",
        "L",
        "XL",
        "XXL",
        "Free Size",
        "34",
        "36",
        "38",
        "40",
      ],
    },
    customTailoring: { type: Boolean, default: false },
    careInstructions: { type: String, trim: true },
  }),
);

import { Schema } from "mongoose";
import { Product } from "./base-product.model";
import { IAccessoryProduct } from "../interfaces";

export const Accessory = Product.discriminator<IAccessoryProduct>(
  "ACCESSORY",
  new Schema({
    sizeDetails: { type: String, required: true, trim: true },
  }),
);

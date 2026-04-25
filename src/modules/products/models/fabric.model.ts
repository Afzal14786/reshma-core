import { Schema } from "mongoose";
import { Product } from "./base-product.model";
import { IFabricProduct } from "../interfaces";

export const Fabric = Product.discriminator<IFabricProduct>(
  "FABRIC",
  new Schema({
    lengthMeters: { type: Number, required: true, min: 0.1 },
    customTailoring: { type: Boolean, default: true },
  }),
);

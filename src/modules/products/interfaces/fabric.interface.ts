import { IBaseProduct } from "./base-product.interface";

export interface IFabricProduct extends IBaseProduct {
  itemType: "FABRIC";
  lengthMeters: number;
  customTailoring: boolean; // Always true for unstitched fabric
}

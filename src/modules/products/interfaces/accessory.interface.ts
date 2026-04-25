import { IBaseProduct } from "./base-product.interface";

export interface IAccessoryProduct extends IBaseProduct {
  itemType: "ACCESSORY";
  sizeDetails: string; // Flat string for unstructured sizes (e.g., 'Adjustable')
}

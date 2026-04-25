import { IBaseProduct } from "./base-product.interface";

export interface IApparelProduct extends IBaseProduct {
  itemType: "APPAREL";
  sizes: (
    | "XS"
    | "S"
    | "M"
    | "L"
    | "XL"
    | "XXL"
    | "Free Size"
    | "34"
    | "36"
    | "38"
    | "40"
  )[];
  customTailoring: boolean;
  careInstructions?: string;
}

import { IBaseProduct } from "./base-product.interface";

export interface IInnerwearProduct extends IBaseProduct {
  itemType: "INNERWEAR";
  cupSizes: ("32B" | "34B" | "36C" | "34C" | "36D")[];
  isReturnable: boolean; // Strictly enforced as false for hygiene
}

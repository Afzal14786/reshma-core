import { TaxProfile } from "@modules/orders/tax.utils";

export interface ProductOverrides {
  itemType?: "BANGLE" | "APPAREL" | "FABRIC" | "INNERWEAR" | "ACCESSORY";
  sku?: string;
  name?: string;
  mainCategory?: "Sarees" | "Apparel" | "Accessories" | "Innerwear" | "Bangles";
  subCategory?: string;
  material?: string;
  sellingUnit?: "Single Piece" | "Meter" | "Set" | "Pair" | "Dozen" | "Pack";
  colors?: string[];
  basePrice?: number;
  discount?: number;
  currentStock?: number;
  weightGrams?: number;
  isFragile?: boolean;
  images?: string[];
  hsnCode?: string;
  taxProfile?: TaxProfile;
  isActive?: boolean;
}

let skuCounter = 0;

export function buildProductPayload(overrides: ProductOverrides = {}) {
  skuCounter += 1;
  return {
    itemType: overrides.itemType ?? ("BANGLE" as const),
    sku: overrides.sku ?? `TEST-SKU-${Date.now()}-${skuCounter}`,
    name: overrides.name ?? `Test Product ${skuCounter}`,
    mainCategory: overrides.mainCategory ?? ("Bangles" as const),
    subCategory: overrides.subCategory ?? "Glass",
    material: overrides.material ?? "Glass",
    sellingUnit: overrides.sellingUnit ?? ("Single Piece" as const),
    colors: overrides.colors ?? ["Red"],
    basePrice: overrides.basePrice ?? 1000,
    discount: overrides.discount ?? 0,
    currentStock: overrides.currentStock ?? 50,
    weightGrams: overrides.weightGrams ?? 100,
    isFragile: overrides.isFragile ?? false,
    images: overrides.images ?? ["https://example.com/test.jpg"],
    hsnCode: overrides.hsnCode ?? "7117",
    taxProfile: overrides.taxProfile ?? TaxProfile.IMITATION_JEWELLERY,
    isActive: overrides.isActive ?? true,
  };
}

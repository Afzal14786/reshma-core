import { TaxProfile } from "@modules/orders/tax.utils";

let skuCounter = 0;
const nextSku = (prefix: string): string => {
  skuCounter += 1;
  return `${prefix}-${Date.now()}-${skuCounter}`;
};

// ─────────────────────────────────────────────
// Multipart form-data builders (for POST /products)
// Everything is a STRING because multipart sends strings.
// ─────────────────────────────────────────────

export type MultipartProductFields = Record<string, string>;

const multipartBase = (overrides: Partial<MultipartProductFields>) => ({
  sku: nextSku("MULTI"),
  name: "Test Product",
  subCategory: "Test",
  material: "Test",
  sellingUnit: "Single Piece",
  colors: JSON.stringify(["Red"]),
  basePrice: "1000",
  discount: "0",
  currentStock: "50",
  weightGrams: "100",
  isFragile: "false",
  tags: JSON.stringify(["test"]),
  isActive: "true",
  hsnCode: "7117",
  taxProfile: TaxProfile.IMITATION_JEWELLERY,
  ...overrides,
});

export function bangleMultipartFields(
  o: Partial<MultipartProductFields> = {},
): MultipartProductFields {
  return {
    itemType: "BANGLE",
    mainCategory: "Bangles",
    bangleSizes: JSON.stringify(["2.4", "2.6"]),
    packSize: "12",
    ...multipartBase(o),
  };
}

export function apparelMultipartFields(
  o: Partial<MultipartProductFields> = {},
): MultipartProductFields {
  return {
    itemType: "APPAREL",
    mainCategory: "Apparel",
    sizes: JSON.stringify(["M", "L"]),
    customTailoring: "false",
    ...multipartBase({ hsnCode: "5407", ...o }),
  };
}

export function fabricMultipartFields(
  o: Partial<MultipartProductFields> = {},
): MultipartProductFields {
  return {
    itemType: "FABRIC",
    mainCategory: "Sarees",
    lengthMeters: "5.5",
    customTailoring: "true",
    sellingUnit: "Meter",
    ...multipartBase({ hsnCode: "5208", ...o }),
  };
}

export function innerwearMultipartFields(
  o: Partial<MultipartProductFields> = {},
): MultipartProductFields {
  return {
    itemType: "INNERWEAR",
    mainCategory: "Innerwear",
    cupSizes: JSON.stringify(["34B", "36C"]),
    isReturnable: "false",
    ...multipartBase({ hsnCode: "6108", ...o }),
  };
}

export function accessoryMultipartFields(
  o: Partial<MultipartProductFields> = {},
): MultipartProductFields {
  return {
    itemType: "ACCESSORY",
    mainCategory: "Accessories",
    sizeDetails: "Adjustable",
    ...multipartBase({ hsnCode: "4202", ...o }),
  };
}

// ─────────────────────────────────────────────
// Direct DB payloads (for seeds in GET/PATCH tests)
// ─────────────────────────────────────────────

export interface ProductOverrides {
  sku?: string;
  name?: string;
  basePrice?: number;
  currentStock?: number;
  isActive?: boolean;
  isFragile?: boolean;
  subCategory?: string;
  material?: string;
  colors?: string[];
  tags?: string[];
  images?: string[];
}

function baseDoc(o: ProductOverrides) {
  return {
    sku: o.sku ?? nextSku("DIRECT"),
    name: o.name ?? "Direct Product",
    subCategory: o.subCategory ?? "Glass",
    material: o.material ?? "Glass",
    sellingUnit: "Single Piece" as const,
    colors: o.colors ?? ["Red"],
    basePrice: o.basePrice ?? 1000,
    discount: 0,
    currentStock: o.currentStock ?? 50,
    weightGrams: 100,
    isFragile: o.isFragile ?? false,
    images: o.images ?? ["https://example.com/img.jpg"],
    tags: o.tags ?? ["direct"],
    hsnCode: "7117",
    taxProfile: TaxProfile.IMITATION_JEWELLERY,
    isActive: o.isActive ?? true,
  };
}

export const buildBangle = (o: ProductOverrides = {}) => ({
  ...baseDoc(o),
  itemType: "BANGLE" as const,
  mainCategory: "Bangles" as const,
  bangleSizes: ["2.4"],
  packSize: 12,
});

export const buildApparel = (o: ProductOverrides = {}) => ({
  ...baseDoc(o),
  itemType: "APPAREL" as const,
  mainCategory: "Apparel" as const,
  sizes: ["M", "L"],
  customTailoring: false,
});

export const buildFabric = (o: ProductOverrides = {}) => ({
  ...baseDoc(o),
  itemType: "FABRIC" as const,
  mainCategory: "Sarees" as const,
  sellingUnit: "Meter" as const,
  lengthMeters: 5.5,
  customTailoring: true,
});

export const buildInnerwear = (o: ProductOverrides = {}) => ({
  ...baseDoc(o),
  itemType: "INNERWEAR" as const,
  mainCategory: "Innerwear" as const,
  cupSizes: ["34B"],
  isReturnable: false,
});

export const buildAccessory = (o: ProductOverrides = {}) => ({
  ...baseDoc(o),
  itemType: "ACCESSORY" as const,
  mainCategory: "Accessories" as const,
  sizeDetails: "Adjustable",
});
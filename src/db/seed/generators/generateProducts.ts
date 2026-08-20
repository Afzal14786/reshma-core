import { faker } from "@faker-js/faker";
import {
  pickRandom,
  generateSKU,
  generatePrice,
  generateStock,
  generateDiscount,
  IMAGE_POOLS,
} from "./base-generator";
import categoriesData from "../data/users/categories.json";
import { ICategoryMapping, IBaseProduct } from "../types";

// ---- Helper to get valid category ----
const getCategoryForType = (
  itemType: string,
): { main: string; sub: string } => {
  // Must match the `mainCategory` enum in base-product.model.ts:
  // ["Sarees", "Apparel", "Accessories", "Innerwear", "Bangles"]
  const mapping: Record<string, string> = {
    BANGLE: "Bangles",
    APPAREL: "Apparel",
    FABRIC: "Sarees", // <- fixed
    INNERWEAR: "Innerwear",
    ACCESSORY: "Accessories",
  };
  const mainCategory = mapping[itemType];
  if (!mainCategory) throw new Error(`Unknown itemType: ${itemType}`);
  const categoryEntry = categoriesData.categories.find(
    (c: ICategoryMapping) => c.main === mainCategory,
  );
  if (!categoryEntry)
    throw new Error(`No category found for main: ${mainCategory}`);
  const subCategory = pickRandom(categoryEntry.sub);
  return { main: mainCategory, sub: subCategory };
};

// ---- Name generation pools ----
const ADJECTIVES = [
  "Premium",
  "Designer",
  "Handcrafted",
  "Bridal",
  "Festive",
  "Elegant",
  "Classic",
  "Luxury",
  "Traditional",
  "Contemporary",
  "Royal",
  "Regal",
  "Artisanal",
  "Exquisite",
];
const getAdjective = () => pickRandom(ADJECTIVES);

// ---- Style pools ----
const APPAREL_STYLES = [
  "Anarkali Suit",
  "A‑Line Kurti",
  "Georgette Lehenga",
  "Palazzo Set",
  "Straight Kurta",
  "Sharara Set",
  "Embroidered Saree",
  "Designer Blouse",
];
const BANGLE_STYLES = [
  "Bridal Chura",
  "Kundan Studded Set",
  "Velvet Thread Bangles",
  "Oxidized Silver Kadas",
  "Meenakari Glass Bangles",
  "Gold Plated Bangles",
  "Lac Bangles",
  "Stone Studded Bangles",
];
const FABRIC_STYLES = [
  "Banarasi Unstitched Suit",
  "Chanderi Dress Material",
  "Floral Print Fabric",
  "Bandhani Material",
  "Silk Dupatta",
  "Cotton Saree Fabric",
  "Georgette Chiffon",
];
const INNERWEAR_STYLES = [
  "Seamless Comfort Bra",
  "Cotton Spandex Bra",
  "Non‑Wire Bra",
  "Padded Everyday Bra",
  "Lace Trim Bra",
  "Sports Bra",
  "Bralette",
];
const ACCESSORY_STYLES = [
  "Polki Drop Earrings",
  "Kundan Choker",
  "Bridal Matha Patti",
  "Oxidized Jhumkas",
  "Pearl Necklace",
  "Gold Plated Ring",
  "Silver Anklet",
  "Hair Accessory Set",
];

// ---- Helper for required fields ----
const generateHsnCode = (): string => `${faker.string.numeric(6)}`;

// sellingUnit enum: "Single Piece", "Meter", "Set", "Pair", "Dozen", "Pack"
const generateSellingUnit = (itemType: string): string => {
  const unitMap: Record<string, string[]> = {
    BANGLE: ["Dozen", "Set"],
    APPAREL: ["Single Piece"],
    FABRIC: ["Meter"],
    INNERWEAR: ["Single Piece"],
    ACCESSORY: ["Single Piece", "Set"],
  };
  return pickRandom(unitMap[itemType] || ["Single Piece"]);
};

// taxProfile enum: "IMITATION_JEWELLERY", "LAC_JEWELLERY", "UNSTITCHED_FABRIC", "STITCHED_APPAREL", "GENERAL_ACCESSORY", "FOOTWEAR"
const generateTaxProfile = (itemType: string): string => {
  const profileMap: Record<string, string[]> = {
    BANGLE: ["IMITATION_JEWELLERY", "LAC_JEWELLERY"],
    APPAREL: ["STITCHED_APPAREL"],
    FABRIC: ["UNSTITCHED_FABRIC"],
    INNERWEAR: ["STITCHED_APPAREL"],
    ACCESSORY: ["IMITATION_JEWELLERY", "GENERAL_ACCESSORY"],
  };
  return pickRandom(profileMap[itemType] || ["GENERAL_ACCESSORY"]);
};

const generateColors = (): string[] => {
  const allColors = [
    "Red",
    "Blue",
    "Green",
    "Gold",
    "Silver",
    "Black",
    "White",
    "Pink",
    "Maroon",
    "Purple",
    "Yellow",
    "Orange",
  ];
  const count = faker.number.int({ min: 1, max: 3 });
  return faker.helpers.arrayElements(allColors, count);
};

// ---- Generator functions ----
export const generateBangles = (count = 100): IBaseProduct[] => {
  const products = [];
  const { main, sub } = getCategoryForType("BANGLE");
  const images = IMAGE_POOLS.BANGLE;
  for (let i = 0; i < count; i++) {
    const name = `${getAdjective()} ${pickRandom(BANGLE_STYLES)} ${faker.number.int({ min: 1, max: 100 })}`;
    products.push({
      name,
      sku: generateSKU("RB-BAN", i + 1),
      description: `Experience the elegance of our ${name}. Handcrafted with precision.`,
      mainCategory: main,
      subCategory: sub,
      material: pickRandom(["Glass", "Metal", "Lac", "Wood", "Gold Plated"]),
      colors: generateColors(),
      sellingUnit: generateSellingUnit("BANGLE"),
      basePrice: generatePrice(200, 5000),
      discount: generateDiscount(),
      currentStock: generateStock(),
      weightGrams: faker.number.int({ min: 100, max: 500 }),
      isFragile: true,
      images: [pickRandom(images), pickRandom(images)],
      tags: ["bangles", "traditional", "festive", "handcrafted"],
      itemType: "BANGLE",
      hsnCode: generateHsnCode(),
      taxProfile: generateTaxProfile("BANGLE"),
      bangleSizes: pickRandom([
        ["2.2", "2.4"],
        ["2.4", "2.6"],
        ["2.6", "2.8"],
        ["2.2", "2.4", "2.6"],
      ]) as ("2.2" | "2.4" | "2.6" | "2.8")[],
      packSize: pickRandom([6, 12, 24]),
    });
  }
  return products;
};

export const generateApparel = (count = 100): IBaseProduct[] => {
  const products = [];
  const { main, sub } = getCategoryForType("APPAREL");
  const images = IMAGE_POOLS.APPAREL;
  for (let i = 0; i < count; i++) {
    const name = `${getAdjective()} ${pickRandom(APPAREL_STYLES)} ${faker.number.int({ min: 1, max: 100 })}`;
    products.push({
      name,
      sku: generateSKU("RB-APP", i + 1),
      description: `Elevate your wardrobe with this exquisite ${name}. Premium fabric for ultimate comfort.`,
      mainCategory: main,
      subCategory: sub,
      material: pickRandom([
        "Cotton Blend",
        "Silk",
        "Georgette",
        "Chiffon",
        "Velvet",
      ]),
      colors: generateColors(),
      sellingUnit: generateSellingUnit("APPAREL"),
      basePrice: generatePrice(500, 8000),
      discount: generateDiscount(),
      currentStock: generateStock(),
      weightGrams: faker.number.int({ min: 200, max: 600 }),
      isFragile: false,
      images: [pickRandom(images), pickRandom(images)],
      tags: ["apparel", "ethnic", "fashion", "wearable"],
      itemType: "APPAREL",
      hsnCode: generateHsnCode(),
      taxProfile: generateTaxProfile("APPAREL"),
      sizes: pickRandom([
        ["S", "M", "L"],
        ["M", "L", "XL"],
        ["S", "M", "L", "XL"],
        ["M", "L", "XL", "XXL"],
      ]) as ("S" | "M" | "L" | "XL" | "XXL")[],
      customTailoring: faker.datatype.boolean(),
      careInstructions: pickRandom([
        "Dry Clean Only",
        "Machine Wash",
        "Hand Wash",
      ]),
    });
  }
  return products;
};

export const generateFabric = (count = 100): IBaseProduct[] => {
  const products = [];
  const { main, sub } = getCategoryForType("FABRIC");
  const images = IMAGE_POOLS.FABRIC;
  for (let i = 0; i < count; i++) {
    const name = `${getAdjective()} ${pickRandom(FABRIC_STYLES)} ${faker.number.int({ min: 1, max: 100 })}`;
    products.push({
      name,
      sku: generateSKU("RB-FAB", i + 1),
      description: `Premium ${name} – ideal for custom tailoring. Soft texture and vibrant colours.`,
      mainCategory: main,
      subCategory: sub,
      material: pickRandom([
        "Silk",
        "Cotton",
        "Chanderi",
        "Georgette",
        "Linen",
      ]),
      colors: generateColors(),
      sellingUnit: generateSellingUnit("FABRIC"),
      basePrice: generatePrice(300, 4000),
      discount: generateDiscount(),
      currentStock: generateStock(),
      weightGrams: faker.number.int({ min: 300, max: 800 }),
      isFragile: false,
      images: [pickRandom(images), pickRandom(images)],
      tags: ["fabric", "unstitched", "tailoring", "dress material"],
      itemType: "FABRIC",
      hsnCode: generateHsnCode(),
      taxProfile: generateTaxProfile("FABRIC"),
      lengthMeters: faker.number.float({ min: 2.5, max: 6.0, multipleOf: 0.5 }),
      customTailoring: true,
    });
  }
  return products;
};

export const generateInnerwear = (count = 100): IBaseProduct[] => {
  const products = [];
  const { main, sub } = getCategoryForType("INNERWEAR");
  const images = IMAGE_POOLS.INNERWEAR;
  for (let i = 0; i < count; i++) {
    const name = `${getAdjective()} ${pickRandom(INNERWEAR_STYLES)} ${faker.number.int({ min: 1, max: 100 })}`;
    products.push({
      name,
      sku: generateSKU("RB-INN", i + 1),
      description: `Experience ultimate comfort with our ${name}. Soft, breathable fabric for all-day wear.`,
      mainCategory: main,
      subCategory: sub,
      material: pickRandom(["Cotton Spandex", "Nylon", "Lace", "Microfiber"]),
      colors: generateColors(),
      sellingUnit: generateSellingUnit("INNERWEAR"),
      basePrice: generatePrice(200, 1500),
      discount: generateDiscount(),
      currentStock: generateStock(),
      weightGrams: faker.number.int({ min: 50, max: 150 }),
      isFragile: false,
      images: [pickRandom(images), pickRandom(images)],
      tags: ["innerwear", "comfort", "everyday", "lingerie"],
      itemType: "INNERWEAR",
      hsnCode: generateHsnCode(),
      taxProfile: generateTaxProfile("INNERWEAR"),
      // FIXED: only allowed cup sizes: 32B, 34B, 36C, 34C, 36D
      cupSizes: pickRandom([
        ["32B", "34B", "36C"],
        ["34B", "36C", "34C"],
        ["32B", "34B", "34C", "36D"],
      ]) as ("32B" | "34B" | "36C" | "34C" | "36D")[],
      isReturnable: false,
    });
  }
  return products;
};

export const generateAccessories = (count = 100): IBaseProduct[] => {
  const products = [];
  const { main, sub } = getCategoryForType("ACCESSORY");
  const images = IMAGE_POOLS.ACCESSORY;
  for (let i = 0; i < count; i++) {
    const name = `${getAdjective()} ${pickRandom(ACCESSORY_STYLES)} ${faker.number.int({ min: 1, max: 100 })}`;
    products.push({
      name,
      sku: generateSKU("RB-ACC", i + 1),
      description: `Add a touch of elegance with our stunning ${name}. Perfect for weddings and festive occasions.`,
      mainCategory: main,
      subCategory: sub,
      material: pickRandom([
        "Alloy",
        "Silver",
        "Gold Plated",
        "Brass",
        "Copper",
      ]),
      colors: generateColors(),
      sellingUnit: generateSellingUnit("ACCESSORY"),
      basePrice: generatePrice(150, 3000),
      discount: generateDiscount(),
      currentStock: generateStock(),
      weightGrams: faker.number.int({ min: 50, max: 300 }),
      isFragile: faker.datatype.boolean(),
      images: [pickRandom(images), pickRandom(images)],
      tags: ["accessories", "jewelry", "fashion", "ornaments"],
      itemType: "ACCESSORY",
      hsnCode: generateHsnCode(),
      taxProfile: generateTaxProfile("ACCESSORY"),
      sizeDetails: pickRandom([
        "Adjustable",
        "Free Size",
        "One Size",
        "Length: 18 inches",
        "Diameter: 2.5 cm",
      ]),
    });
  }
  return products;
};

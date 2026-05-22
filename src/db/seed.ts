import mongoose from "mongoose";
import env from "../config/env";
import {
  Product,
  Apparel,
  Bangle,
  Fabric,
  Innerwear,
  Accessory,
} from "../modules/products/models";

/**
 * Reshma-Core Database Seeder
 * WARNING: Running this script will WIPE the existing products collection
 * before inserting the new 500 items.
 */

// STRICT TYPING (Enforcing the Zero 'any' Policy)
interface ISeedTemplate {
  itemType: string;
  mainCategory: string;
  subCategory: string;
  material: string;
  sellingUnit: string;
  colors: string[];
  weightGrams: number;
  isFragile: boolean;
  images?: string[];
  sizes?: string[];
  bangleSizes?: string[];
  cupSizes?: string[];
  customTailoring?: boolean;
  careInstructions?: string;
  packSize?: number;
  lengthMeters?: number;
  isReturnable?: boolean;
  sizeDetails?: string;
  isActive: boolean;
}

// REALISTIC IMAGE DICTIONARIES (Indian Fashion Context)
const IMAGES = {
  APPAREL: [
    "https://images.unsplash.com/photo-1583391733958-61159114f04c?w=800&q=80", // Ethnic Suit
    "https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=800&q=80", // Kurti
    "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&q=80", // Dress
    "https://images.unsplash.com/photo-1613040809024-b4ef7ba99bc3?w=800&q=80", // Saree
  ],
  BANGLE: [
    "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=800&q=80", // Bridal Chura
    "https://images.unsplash.com/photo-1599643478524-fb524b0fb5a6?w=800&q=80", // Glass Bangles
    "https://images.unsplash.com/photo-1602752250014-68f44ff5d9e5?w=800&q=80", // Metal Kadas
  ],
  FABRIC: [
    "https://images.unsplash.com/photo-1568158953181-0021665e718b?w=800&q=80", // Silk Fabric
    "https://images.unsplash.com/photo-1584931423298-c576fda54bc2?w=800&q=80", // Cotton Print
    "https://images.unsplash.com/photo-1605651202774-7d573fd3f12d?w=800&q=80", // Weave
  ],
  INNERWEAR: [
    "https://images.unsplash.com/photo-1618331835717-801e976710b2?w=800&q=80", // Everyday
    "https://images.unsplash.com/photo-1518131672697-613becd4fab5?w=800&q=80", // Seamless
  ],
  ACCESSORY: [
    "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&q=80", // Necklace
    "https://images.unsplash.com/photo-1599643477877-530eb83abc8e?w=800&q=80", // Earrings
    "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=800&q=80", // Jhumkas
  ],
};

// REALISTIC NAME GENERATOR UTILITIES
const getRandomItem = (array: string[]) =>
  array[Math.floor(Math.random() * array.length)];

const adjectives = [
  "Premium",
  "Designer",
  "Handcrafted",
  "Bridal",
  "Festive",
  "Elegant",
  "Classic",
];
const apparelStyles = [
  "Anarkali Suit",
  "A-Line Kurti",
  "Georgette Lehenga",
  "Palazzo Set",
  "Straight Kurta",
];
const bangleStyles = [
  "Bridal Chura",
  "Kundan Studded Set",
  "Velvet Thread Bangles",
  "Oxidized Silver Kadas",
  "Meenakari Glass Bangles",
];
const fabricStyles = [
  "Banarasi Unstitched Suit",
  "Chanderi Dress Material",
  "Floral Print Fabric",
  "Bandhani Material",
];
const accessoryStyles = [
  "Polki Drop Earrings",
  "Kundan Choker",
  "Bridal Matha Patti",
  "Oxidized Jhumkas",
];

const generateRealisticName = (itemType: string): string => {
  const adj = getRandomItem(adjectives);
  switch (itemType) {
    case "APPAREL":
      return `${adj} ${getRandomItem(apparelStyles)}`;
    case "BANGLE":
      return `${adj} ${getRandomItem(bangleStyles)}`;
    case "FABRIC":
      return `${adj} ${getRandomItem(fabricStyles)}`;
    case "ACCESSORY":
      return `${adj} ${getRandomItem(accessoryStyles)}`;
    case "INNERWEAR":
      return `${adj} Seamless Everyday Comfort Bra`;
    default:
      return `${adj} Fashion Item`;
  }
};

// BASE TEMPLATES
const baseApparel: ISeedTemplate = {
  itemType: "APPAREL",
  mainCategory: "Apparel",
  subCategory: "Ethnic Wear",
  material: "Cotton Blend",
  sellingUnit: "Single Piece",
  colors: ["Ruby Red", "Navy Blue", "Emerald Green"],
  weightGrams: 350,
  isFragile: false,
  sizes: ["S", "M", "L", "XL", "XXL"],
  customTailoring: false,
  careInstructions: "Dry Clean Only",
  isActive: true,
};

const baseBangle: ISeedTemplate = {
  itemType: "BANGLE",
  mainCategory: "Bangles",
  subCategory: "Festive Wear",
  material: "GLASS",
  sellingUnit: "Dozen",
  colors: ["Gold", "Maroon", "Emerald"],
  weightGrams: 400,
  isFragile: true,
  bangleSizes: ["2.2", "2.4", "2.6", "2.8"],
  packSize: 12,
  isActive: true,
};

const baseFabric: ISeedTemplate = {
  itemType: "FABRIC",
  mainCategory: "Apparel",
  subCategory: "Unstitched Suit",
  material: "Silk",
  sellingUnit: "Meter",
  colors: ["Yellow", "Pink", "Mint"],
  weightGrams: 450,
  isFragile: false,
  lengthMeters: 2.5,
  customTailoring: true,
  isActive: true,
};

const baseInnerwear: ISeedTemplate = {
  itemType: "INNERWEAR",
  mainCategory: "Innerwear",
  subCategory: "Everyday Bra",
  material: "Cotton Spandex",
  sellingUnit: "Single Piece",
  colors: ["Black", "Nude", "White"],
  weightGrams: 80,
  isFragile: false,
  cupSizes: ["32B", "34B", "36C", "38D"],
  isReturnable: false,
  isActive: true,
};

const baseAccessory: ISeedTemplate = {
  itemType: "ACCESSORY",
  mainCategory: "Accessories",
  subCategory: "Jewelry",
  material: "Alloy",
  sellingUnit: "Set",
  colors: ["Silver", "Gold", "Rose Gold"],
  weightGrams: 150,
  isFragile: true,
  sizeDetails: "Free Size / Adjustable",
  isActive: true,
};

// THE FACTORY GENERATOR
const generateProducts = (
  template: ISeedTemplate,
  count: number,
  prefix: string,
) => {
  const products = [];
  const imageArray = IMAGES[template.itemType as keyof typeof IMAGES] || [
    IMAGES.APPAREL[0],
  ];

  for (let i = 1; i <= count; i++) {
    const randomPrice = Math.floor(Math.random() * (4500 - 450 + 1) + 450);
    const randomStock = Math.floor(Math.random() * 101);
    const randomImage = getRandomItem(imageArray);
    const realisticName = generateRealisticName(template.itemType);

    products.push({
      ...template,
      sku: `${prefix}-${1000 + i}`,
      name: `${realisticName} - Vol ${i}`,
      description: `Experience the elegance of our ${realisticName}. Hand-picked for the modern Indian wardrobe, this item promises premium quality and exceptional comfort.`,
      basePrice: randomPrice,
      currentStock: randomStock,
      images: [randomImage, randomImage], // Mocking a front and back image
      discount: Math.random() > 0.75 ? 15 : 0, // 25% chance of a 15% discount
      tags: [
        template.mainCategory.toLowerCase(),
        template.material.toLowerCase(),
        "trending",
        "festive",
      ],
    });
  }
  return products;
};

// SEED EXECUTION SCRIPT

const seedDatabase = async () => {
  try {
    console.log("⏳ Connecting to MongoDB...");
    await mongoose.connect(env.MONGO_URI as string);
    console.log("✅ MongoDB Connected.");

    console.log("🗑️  Purging existing catalog...");
    await Product.deleteMany({});
    console.log("✅ Catalog purged.");

    console.log("🏭 Generating 500 hyper-realistic products...");
    const apparelItems = generateProducts(baseApparel, 100, "RB-APP");
    const bangleItems = generateProducts(baseBangle, 100, "RB-BAN");
    const fabricItems = generateProducts(baseFabric, 100, "RB-FAB");
    const innerwearItems = generateProducts(baseInnerwear, 100, "RB-INN");
    const accessoryItems = generateProducts(baseAccessory, 100, "RB-ACC");

    console.log(
      "💾 Inserting into Database (Mongoose Discriminators Active)...",
    );

    await Promise.all([
      Apparel.insertMany(apparelItems),
      Bangle.insertMany(bangleItems),
      Fabric.insertMany(fabricItems),
      Innerwear.insertMany(innerwearItems),
      Accessory.insertMany(accessoryItems),
    ]);

    console.log("🎉 SUCCESS: 500 Enterprise-Grade Products have been seeded!");
    process.exit(0);
  } catch (error) {
    console.error("❌ SEEDING FAILED:", error);
    process.exit(1);
  }
};

seedDatabase();

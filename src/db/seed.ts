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

const DUMMY_IMAGE =
  "https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg";

// BASE TEMPLATES (One for each Discriminator)

const baseApparel = {
  itemType: "APPAREL",
  mainCategory: "Apparel",
  subCategory: "Kurti",
  material: "Cotton",
  sellingUnit: "Single Piece",
  colors: ["Red", "Blue", "Green"],
  weightGrams: 250,
  isFragile: false,
  images: [DUMMY_IMAGE],
  sizes: ["S", "M", "L", "XL"],
  customTailoring: false,
  careInstructions: "Machine wash cold",
  isActive: true,
};

const baseBangle = {
  itemType: "BANGLE",
  mainCategory: "Bangles",
  subCategory: "Glass Bangles",
  material: "GLASS",
  sellingUnit: "Dozen",
  colors: ["Gold", "Maroon"],
  weightGrams: 350,
  isFragile: true,
  images: [DUMMY_IMAGE],
  bangleSizes: ["2.2", "2.4", "2.6", "2.8"],
  packSize: 12,
  isActive: true,
};

const baseFabric = {
  itemType: "FABRIC",
  mainCategory: "Apparel",
  subCategory: "Unstitched Suit",
  material: "Silk",
  sellingUnit: "Meter",
  colors: ["Yellow", "Pink"],
  weightGrams: 400,
  isFragile: false,
  images: [DUMMY_IMAGE],
  lengthMeters: 2.5,
  customTailoring: true,
  isActive: true,
};

const baseInnerwear = {
  itemType: "INNERWEAR",
  mainCategory: "Innerwear",
  subCategory: "Everyday Bra",
  material: "Cotton Blend",
  sellingUnit: "Single Piece",
  colors: ["Black", "Nude", "White"],
  weightGrams: 50,
  isFragile: false,
  images: [DUMMY_IMAGE],
  cupSizes: ["32B", "34B", "36C"],
  isReturnable: false,
  isActive: true,
};

const baseAccessory = {
  itemType: "ACCESSORY",
  mainCategory: "Accessories",
  subCategory: "Jewelry",
  material: "Alloy",
  sellingUnit: "Set",
  colors: ["Silver", "Gold"],
  weightGrams: 150,
  isFragile: true,
  images: [DUMMY_IMAGE],
  sizeDetails: "Free Size / Adjustable",
  isActive: true,
};

// THE FACTORY GENERATOR

/**
 * Generates an array of varied products based on a template
 */
const generateProducts = (template: any, count: number, prefix: string) => {
  const products = [];
  for (let i = 1; i <= count; i++) {
    // Randomize price between 300 and 3000
    const randomPrice = Math.floor(Math.random() * (3000 - 300 + 1) + 300);
    // Randomize stock between 0 and 100
    const randomStock = Math.floor(Math.random() * 101);

    products.push({
      ...template,
      sku: `${prefix}-${1000 + i}`,
      name: `${template.material} ${template.subCategory} - Variant ${i}`,
      basePrice: randomPrice,
      currentStock: randomStock,
      // Randomly apply a discount to ~20% of items
      discount: Math.random() > 0.8 ? 10 : 0,
      tags: [
        template.mainCategory.toLowerCase(),
        template.material.toLowerCase(),
        `variant${i}`,
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

    console.log("🏭 Generating 500 unique products...");
    // Generate 100 of each category to reach 500 total
    const apparelItems = generateProducts(baseApparel, 100, "RB-APP");
    const bangleItems = generateProducts(baseBangle, 100, "RB-BAN");
    const fabricItems = generateProducts(baseFabric, 100, "RB-FAB");
    const innerwearItems = generateProducts(baseInnerwear, 100, "RB-INN");
    const accessoryItems = generateProducts(baseAccessory, 100, "RB-ACC");

    console.log(
      "💾 Inserting into Database (Mongoose Discriminators Active)...",
    );

    // We use the specific Discriminator models to insert the data so Mongoose
    // strictly validates the category-specific fields.
    await Promise.all([
      Apparel.insertMany(apparelItems),
      Bangle.insertMany(bangleItems),
      Fabric.insertMany(fabricItems),
      Innerwear.insertMany(innerwearItems),
      Accessory.insertMany(accessoryItems),
    ]);

    console.log("🎉 SUCCESS: 500 Products have been seeded!");
    process.exit(0);
  } catch (error) {
    console.error("❌ SEEDING FAILED:", error);
    process.exit(1);
  }
};

// Execute the function
seedDatabase();

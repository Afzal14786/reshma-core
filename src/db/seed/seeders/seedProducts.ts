import {
  Bangle,
  Apparel,
  Fabric,
  Innerwear,
  Accessory,
  Product,
} from "@modules/products/models";
import {
  generateBangles,
  generateApparel,
  generateFabric,
  generateInnerwear,
  generateAccessories,
} from "../generators/generateProducts";

/**
 * Seed all product types into the database.
 * Deletes all existing products before seeding (optional – use with care).
 */
export const seedProducts = async (clearExisting = true): Promise<void> => {
  console.log("📦 Seeding products...");

  if (clearExisting) {
    await Product.deleteMany({});
    console.log("🧹 Cleared existing products.");
  }

  // 1. Bangles
  const bangles = generateBangles(100);
  await Bangle.insertMany(bangles);
  console.log(`✅ Seeded ${bangles.length} bangles.`);

  // 2. Apparel
  const apparel = generateApparel(100);
  await Apparel.insertMany(apparel);
  console.log(`✅ Seeded ${apparel.length} apparel items.`);

  // 3. Fabric
  const fabric = generateFabric(100);
  await Fabric.insertMany(fabric);
  console.log(`✅ Seeded ${fabric.length} fabric items.`);

  // 4. Innerwear
  const innerwear = generateInnerwear(100);
  await Innerwear.insertMany(innerwear);
  console.log(`✅ Seeded ${innerwear.length} innerwear items.`);

  // 5. Accessories
  const accessories = generateAccessories(100);
  await Accessory.insertMany(accessories);
  console.log(`✅ Seeded ${accessories.length} accessories.`);

  const total = await Product.countDocuments();
  console.log(`📊 Total products now: ${total}`);
};

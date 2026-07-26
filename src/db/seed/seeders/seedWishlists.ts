import { Wishlist } from "@modules/wishlists/wishlist.model";
import { generateWishlists } from "../generators/generateWishlists";

/**
 * Seed wishlists for all users.
 */
export const seedWishlists = async (): Promise<void> => {
  console.log("💝 Seeding wishlists...");

  const wishlistData = await generateWishlists();

  if (wishlistData.length === 0) {
    console.log("⚠️ No wishlists generated.");
    return;
  }

  // Insert wishlists with ordered: false to continue on duplicate errors
  const insertedWishlists = await Wishlist.insertMany(wishlistData, {
    ordered: false,
  });
  console.log(`✅ Inserted ${insertedWishlists.length} wishlists.`);

  // Calculate total items across all wishlists
  let totalItems = 0;
  for (const wl of insertedWishlists) {
    totalItems += wl.items.length;
  }
  console.log(`📊 Total wishlist items across all users: ${totalItems}`);

  // Log total wishlists
  const total = await Wishlist.countDocuments();
  console.log(`📊 Total wishlists now: ${total}`);
};

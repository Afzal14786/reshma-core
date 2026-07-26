import { faker } from "@faker-js/faker";
import { Types } from "mongoose";
import { User } from "@modules/users/user.model";
import { Product } from "@modules/products/models";
import { IWishlistItemInput, IWishlistInput } from "../types";

/**
 * Main generator: fetches users and active products, then builds wishlists.
 */
export const generateWishlists = async (): Promise<IWishlistInput[]> => {
  // ---- Fetch all users ----
  const users = await User.find().select("_id").lean();
  if (users.length === 0) {
    throw new Error("No users found. Please seed users first.");
  }

  // ---- Fetch all active products ----
  const products = await Product.find({ isActive: true }).select("_id").lean();
  if (products.length === 0) {
    throw new Error("No active products found. Please seed products first.");
  }

  const wishlists: IWishlistInput[] = [];

  for (const user of users) {
    // Determine number of items for this wishlist (5-10, but not exceed available products)
    const maxItems = Math.min(products.length, 10);
    const itemCount = faker.number.int({
      min: Math.min(5, maxItems),
      max: Math.min(10, maxItems),
    });

    // Shuffle products and pick random ones
    const shuffledProducts = faker.helpers.shuffle(products);
    const selectedProducts = shuffledProducts.slice(0, itemCount);

    // Build items array with addedAt dates (spread over last 30 days)
    const items: IWishlistItemInput[] = selectedProducts.map((product) => ({
      product: product._id,
      addedAt: faker.date.recent({ days: 30 }),
    }));

    wishlists.push({
      user: user._id,
      items,
    });
  }

  return wishlists;
};

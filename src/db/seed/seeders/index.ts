import { seedUsers } from "./seedUsers";
import { seedProducts } from "./seedProducts";
import { seedCoupons } from "./seedCoupons";
import { seedOrders } from "./seedOrders";
import { seedReturns } from "./seedReturns";
import { seedInteractions } from "./seedInteractions";
import { seedWishlists } from "./seedWishlists";
import { seedNotifications } from "./seedNotifications";
import { seedSupport } from "./seedSupport";

export const seedDatabase = async () => {
  try {
    console.log("🚀 Starting database seeding...\n");

    // ---- Module 1: Users (must be first) ----
    await seedUsers(50); // 1 admin + 50 random users
    console.log("(admin + random) User Dataset generated successfully");

    // ---- Module 2: Products ----
    await seedProducts(true); // clear existing and seed 500 products (100 per type)
    console.log("All Products Dataset Generated");

    // ---- Module 3: Coupons ----
    await seedCoupons(true); // clear existing and seed static + dynamic coupons
    console.log("All Coupons Dataset Generated");

    // ---- Module 4: Orders (depends on Users & Products) ----
    await seedOrders(150); // generate 150 orders with varied statuses
    console.log("All Orders Dataset Generated");

    // ---- Module 5: Returns (depends on Orders) ----
    await seedReturns(40); // generate 40 return requests from delivered orders
    console.log("All Returns Dataset Generated");

    // ---- Module 6: Interactions (depends on Users & Products) ----
    await seedInteractions(); // generate reviews and comments
    console.log("All Interactions Dataset Generated");

    // ---- Module 7: Wishlists (depends on Users & Products) ----
    await seedWishlists(); // each user gets 5-10 wishlist items
    console.log("All Wishlists Dataset Generated");

    // ---- Module 8: Notifications (depends on Orders, Returns) ----
    await seedNotifications(); // generate notifications for orders, returns, etc.
    console.log("All Notifications Dataset Generated");

    await seedSupport();
    console.log("All Supports Dataset Generated");

    console.log("✅ All seeding completed successfully.");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    throw error;
  }
};

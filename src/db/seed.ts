import mongoose from "mongoose";
import env from "../config/env";
import { seedDatabase } from "./seed/seeders";

const run = async () => {
  try {
    console.log("⏳ Connecting to MongoDB...");
    await mongoose.connect(env.MONGO_URI as string);
    console.log("✅ Connected to MongoDB.\n");

    await seedDatabase();

    console.log("\n🎉 Seeding complete!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
};

// Handle unexpected errors
process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
  process.exit(1);
});

run();

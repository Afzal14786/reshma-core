import bcrypt from "bcrypt";
import { User } from "@modules/users/user.model";
import { generateUsers, getAdminUser } from "../generators/generateUsers";

/**
 * Hash a password
 */
const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
};

/**
 * Seed users (admin + random users)
 */
export const seedUsers = async (userCount = 50): Promise<void> => {
  console.log("👤 Seeding users...");

  // 1. Admin user (upsert)
  const adminData = getAdminUser();
  const hashedAdminPassword = await hashPassword(adminData.password);

  await User.updateOne(
    { email: adminData.email },
    {
      ...adminData,
      password: hashedAdminPassword,
    },
    { upsert: true },
  );
  console.log(`✅ Admin user seeded: ${adminData.email}`);

  // 2. Generate random users
  const randomUsers = generateUsers(userCount);
  const hashedRandomUsers = await Promise.all(
    randomUsers.map(async (user) => ({
      ...user,
      password: await hashPassword(user.password),
    })),
  );

  // Bulk insert (skip duplicates by email)
  for (const user of hashedRandomUsers) {
    await User.updateOne(
      { email: user.email },
      { $setOnInsert: user }, // only insert if not exists
      { upsert: true },
    );
  }

  console.log(`✅ ${userCount} random users seeded.`);

  // Log total users count
  const total = await User.countDocuments();
  console.log(`📊 Total users now: ${total}`);
};

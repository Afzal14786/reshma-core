import { faker } from "@faker-js/faker";
import { ISeedUser } from "../types";
import { generateAddress, pickRandom, AVATAR_POOL } from "./base-generator";
import adminData from "../data/users/admin.json";

/**
 * Generate a single random user (regular user)
 */
const generateRandomUser = (): ISeedUser => {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const email = faker.internet.email({ firstName, lastName }).toLowerCase();

  // 2–3 addresses, one default
  const addresses = [];
  const numAddresses = faker.number.int({ min: 2, max: 3 });
  for (let i = 0; i < numAddresses; i++) {
    addresses.push(generateAddress(i === 0)); // first one is default
  }

  return {
    firstname: firstName,
    lastname: lastName,
    email,
    password: "User@123", // default password for all generated users
    phone: faker.phone.number({ style: "international" }).replace(/\s/g, ""),
    avatar: pickRandom(AVATAR_POOL),
    role: "USER",
    isEmailVerified: Math.random() > 0.2, // 80% verified
    loyaltyPoints: faker.number.int({ min: 0, max: 500 }),
    addresses,
  };
};

/**
 * Generate an array of random users (excluding admin)
 */
export const generateUsers = (count = 50): ISeedUser[] => {
  const users: ISeedUser[] = [];
  for (let i = 0; i < count; i++) {
    users.push(generateRandomUser());
  }
  return users;
};

/**
 * Get the admin user from static data
 */
export const getAdminUser = (): ISeedUser => {
  return adminData as ISeedUser;
};

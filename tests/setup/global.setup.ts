// ──────────────────────────────────────────────
// Global Testcontainers Setup (Alternative to Docker Compose)
// Use this if you prefer ephemeral per-suite containers
// instead of static docker-compose services.
// ──────────────────────────────────────────────

import { MongoDBContainer } from "@testcontainers/mongodb";
import { RedisContainer } from "@testcontainers/redis";

let mongoContainer: MongoDBContainer | null = null;
let redisContainer: RedisContainer | null = null;

export async function startTestContainers(): Promise<void> {
  mongoContainer = await new MongoDBContainer("mongo:7.0").start();
  redisContainer = await new RedisContainer("redis:7-alpine").start();

  process.env.MONGO_URI = mongoContainer.getConnectionString();
  process.env.REDIS_URL = `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`;

  console.log("🐳 Testcontainers started.");
}

export async function stopTestContainers(): Promise<void> {
  if (mongoContainer) await mongoContainer.stop();
  if (redisContainer) await redisContainer.stop();
  console.log("🐳 Testcontainers stopped.");
}
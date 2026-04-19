import { createClient } from 'redis';
import env from './env';
import logger from './logger';

const redisOptions = {
  url: env.REDIS_URL,
  ...(env.REDIS_PASSWORD && { password: env.REDIS_PASSWORD }),
};

export const redisClient = createClient(redisOptions);

redisClient.on('error', (err: Error) => {
  logger.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  logger.info('Redis connection process initiated');
});

redisClient.on('ready', () => {
  logger.info('Redis ready and connected successfully');
});

redisClient.on('reconnecting', () => {
  logger.warn('Redis reconnecting...');
});

/**
 * Connect the Redis client and wait for a successful connection.
 * @returns A promise that resolves when the client is connected and ready.
 */
export const connectRedis = async (): Promise<void> => {
  await redisClient.connect();
};
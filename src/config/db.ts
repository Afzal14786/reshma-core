import mongoose from 'mongoose';
import env from './env';
import logger from './logger';

/**
 * Establishes connection to the MongoDB Atlas cluster.
 * Exits the process entirely if the connection fails to prevent app corruption.
 */
export const connectDB = async (): Promise<void> => {
  try {
    const connection = await mongoose.connect(env.MONGO_URI);
    logger.info(`MongoDB Connected: ${connection.connection.host}`);
  } catch (error) {
    logger.error('Error connecting to MongoDB:', error);
    process.exit(1); 
  }
};
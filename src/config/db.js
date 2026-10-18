import mongoose from 'mongoose';
import dns from 'dns';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

// Configure public DNS servers to prevent Windows local router SRV resolution failures
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (_) {}

let isDbConnected = false;

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });

    isDbConnected = true;
    logger.info(`[MongoDB] Connected successfully: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    isDbConnected = false;
    logger.warn(`[MongoDB] Connection attempt failed: ${error.message}`);
    logger.warn('[MongoDB] Server is running. MongoDB will connect automatically once available.');
    return null;
  }
};

export const checkDbConnection = () => isDbConnected && mongoose.connection.readyState === 1;

mongoose.connection.on('disconnected', () => {
  isDbConnected = false;
  logger.warn('[MongoDB] Disconnected from database');
});

mongoose.connection.on('reconnected', () => {
  isDbConnected = true;
  logger.info('[MongoDB] Reconnected to database');
});

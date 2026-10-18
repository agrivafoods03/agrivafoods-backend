import app from './app.js';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { logger } from './utils/logger.js';

const PORT = env.PORT || 5000;

// Initialize server listener
const server = app.listen(PORT, async () => {
  logger.info(`===============================================`);
  logger.info(`AgrivaFoods Backend Server running on port ${PORT}`);
  logger.info(`Environment: ${env.NODE_ENV}`);
  logger.info(`Health check: http://localhost:${PORT}/api/health`);
  logger.info(`===============================================`);

  // Attempt MongoDB connection in background (non-blocking)
  await connectDB();
});

// Handle graceful shutdowns
const gracefulShutdown = (signal) => {
  logger.warn(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
});

process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`, { stack: error.stack });
});

export default server;

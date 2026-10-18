import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errors = err.errors || [];

  // Mongoose Bad ObjectId
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid resource identifier: ${err.value}`;
  }

  // Mongoose Duplicate Key Error
  if (err.code === 11000) {
    statusCode = 409;
    const fields = Object.keys(err.keyValue || {});
    message = `Duplicate value for field(s): ${fields.join(', ')}. Please use unique values.`;
  }

  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errors = Object.values(err.errors || {}).map((e) => e.message);
    message = 'Validation failed';
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token expired';
  }

  // Log error if it's 500 or uncaught
  if (statusCode >= 500) {
    logger.error(`[UnhandledError] ${err.message}`, { stack: err.stack, path: req.originalUrl, method: req.method });
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors: errors.length > 0 ? errors : [message],
    ...(env.NODE_ENV === 'development' && statusCode >= 500 ? { stack: err.stack } : {})
  });
};

export const notFoundHandler = (req, res, next) => {
  const error = new ApiError(404, `Endpoint not found: ${req.method} ${req.originalUrl}`);
  next(error);
};

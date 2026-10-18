import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { User } from '../models/User.js';
import { checkDbConnection } from '../config/db.js';

export const authenticate = asyncHandler(async (req, res, next) => {
  let token = null;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    throw new ApiError(401, 'Authentication required. No token provided.');
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);

    if (checkDbConnection()) {
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        throw new ApiError(401, 'User associated with this token no longer exists.');
      }
      req.user = user;
    } else {
      // In-memory fallback mode
      req.user = {
        _id: decoded.id,
        id: decoded.id,
        email: decoded.email || 'user@agrivafoods.com',
        role: decoded.role || 'customer',
        name: decoded.name || 'Agriva Customer'
      };
    }

    next();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, 'Invalid or expired token.');
  }
});

export const optionalAuth = asyncHandler(async (req, res, next) => {
  let token = null;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (checkDbConnection()) {
      const user = await User.findById(decoded.id).select('-password');
      req.user = user || null;
    } else {
      req.user = {
        _id: decoded.id,
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        name: decoded.name
      };
    }
  } catch {
    req.user = null;
  }
  next();
});

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required.');
    }
    if (!roles.includes(req.user.role)) {
      throw new ApiError(403, `Access denied. Requires one of roles: [${roles.join(', ')}]`);
    }
    next();
  };
};

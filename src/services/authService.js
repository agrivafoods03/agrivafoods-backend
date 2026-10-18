import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { env } from '../config/env.js';
import { checkDbConnection } from '../config/db.js';
import { memoryStore } from '../utils/memoryStore.js';
import { ApiError } from '../utils/ApiError.js';
import { emailService } from './emailService.js';
import { logger } from '../utils/logger.js';

const generateToken = (payload) => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN || '7d'
  });
};

export class AuthService {
  static async register({ name, email, password, phone }) {
    const normalizedEmail = email.toLowerCase().trim();

    if (checkDbConnection()) {
      const existingUser = await User.findOne({ email: normalizedEmail });
      if (existingUser) {
        throw new ApiError(409, 'An account with this email already exists.');
      }

      const user = await User.create({
        name,
        email: normalizedEmail,
        password,
        phone,
        role: 'customer'
      });

      const token = user.generateAuthToken();
      const userResponse = user.toObject();
      delete userResponse.password;

      // Send admin notification (non-blocking)
      emailService.sendUserRegisteredNotification(userResponse).catch(err => {
        logger.error(`[AuthService] Failed to send new user email: ${err.message}`);
      });

      return { user: userResponse, token };
    } else {
      // In-Memory Mode
      const existing = memoryStore.users.find(u => u.email === normalizedEmail);
      if (existing) {
        throw new ApiError(409, 'An account with this email already exists.');
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = {
        _id: `user_${Date.now()}`,
        name,
        email: normalizedEmail,
        password: hashedPassword,
        phone: phone || '',
        role: 'customer',
        addresses: [],
        wishlist: [],
        isActive: true,
        createdAt: new Date().toISOString()
      };

      memoryStore.users.push(newUser);

      const token = generateToken({
        id: newUser._id,
        email: newUser.email,
        role: newUser.role,
        name: newUser.name
      });

      const { password: _, ...userWithoutPass } = newUser; // eslint-disable-line no-unused-vars

      // Send admin notification (non-blocking)
      emailService.sendUserRegisteredNotification(userWithoutPass).catch(err => {
        logger.error(`[AuthService] Failed to send new user email: ${err.message}`);
      });

      return { user: userWithoutPass, token };
    }
  }

  static async login({ email, password }) {
    const normalizedEmail = email.toLowerCase().trim();

    if (checkDbConnection()) {
      const user = await User.findOne({ email: normalizedEmail }).select('+password');
      if (!user) {
        throw new ApiError(401, 'Invalid email or password.');
      }

      if (user.isActive === false) {
        throw new ApiError(403, 'Your account has been deactivated. Please contact support.');
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        throw new ApiError(401, 'Invalid email or password.');
      }

      const token = user.generateAuthToken();
      const userResponse = user.toObject();
      delete userResponse.password;

      return { user: userResponse, token };
    } else {
      // In-Memory Mode
      const user = memoryStore.users.find(u => u.email === normalizedEmail);
      if (!user) {
        throw new ApiError(401, 'Invalid email or password.');
      }

      if (user.isActive === false) {
        throw new ApiError(403, 'Your account has been deactivated. Please contact support.');
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        throw new ApiError(401, 'Invalid email or password.');
      }

      const token = generateToken({
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name
      });

      const { password: _, ...userWithoutPass } = user; // eslint-disable-line no-unused-vars
      return { user: userWithoutPass, token };
    }
  }

  static async getCurrentUser(userId) {
    if (checkDbConnection()) {
      const user = await User.findById(userId).select('-password');
      if (!user) {
        throw new ApiError(404, 'User not found.');
      }
      return user;
    } else {
      const user = memoryStore.users.find(u => u._id === userId || u.id === userId);
      if (!user) {
        throw new ApiError(404, 'User not found.');
      }
      const { password: _, ...userWithoutPass } = user; // eslint-disable-line no-unused-vars
      return userWithoutPass;
    }
  }

  static async changePassword(userId, oldPassword, newPassword) {
    if (checkDbConnection()) {
      const user = await User.findById(userId).select('+password');
      if (!user) {
        throw new ApiError(404, 'User not found.');
      }

      const isMatch = await user.comparePassword(oldPassword);
      if (!isMatch) {
        throw new ApiError(400, 'Current password does not match.');
      }

      user.password = newPassword;
      await user.save();
      return { success: true, message: 'Password updated successfully' };
    } else {
      const user = memoryStore.users.find(u => u._id === userId || u.id === userId);
      if (!user) {
        throw new ApiError(404, 'User not found.');
      }

      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) {
        throw new ApiError(400, 'Current password does not match.');
      }

      user.password = await bcrypt.hash(newPassword, 10);
      return { success: true, message: 'Password updated successfully' };
    }
  }
}

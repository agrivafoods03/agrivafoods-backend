import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
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

  static async forgotPassword({ email }) {
    if (!email || !email.includes('@')) {
      throw new ApiError(400, 'Please provide a valid administrator email address.');
    }
    const normalizedEmail = email.toLowerCase().trim();

    let admin = null;
    if (checkDbConnection()) {
      admin = await User.findOne({ email: normalizedEmail, role: 'admin' });
      if (!admin && normalizedEmail === (env.ADMIN_NOTIFICATION_EMAIL || '').toLowerCase().trim()) {
        admin = await User.findOne({ role: 'admin' });
      }
    } else {
      admin = memoryStore.users.find(u => u.email === normalizedEmail && u.role === 'admin');
      if (!admin && normalizedEmail === (env.ADMIN_NOTIFICATION_EMAIL || '').toLowerCase().trim()) {
        admin = memoryStore.users.find(u => u.role === 'admin');
      }
    }

    // Generic response if account is not found or inactive to prevent account enumeration
    if (!admin || admin.isActive === false) {
      return {
        message: 'If an eligible administrator account exists, a verification code will be sent.'
      };
    }

    // Cooldown protection: minimum 60 seconds between OTP requests
    if (admin.resetPasswordLastRequested) {
      const elapsedMs = Date.now() - new Date(admin.resetPasswordLastRequested).getTime();
      if (elapsedMs < 60 * 1000) {
        const remainingSec = Math.ceil((60 * 1000 - elapsedMs) / 1000);
        throw new ApiError(429, `Please wait ${remainingSec} seconds before requesting a new verification code.`);
      }
    }

    // Generate cryptographically secure 6-digit OTP
    const rawOtp = String(crypto.randomInt(100000, 1000000));
    const otpHash = crypto.createHash('sha256').update(rawOtp).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    admin.resetPasswordOtpHash = otpHash;
    admin.resetPasswordOtpExpires = expiresAt;
    admin.resetPasswordOtpAttempts = 0;
    admin.resetPasswordLastRequested = new Date();
    admin.resetPasswordToken = null;
    admin.resetPasswordTokenExpires = null;

    if (checkDbConnection()) {
      await admin.save();
    }

    // Deliver email via Nodemailer
    const deliveryTarget = (admin.email && !admin.email.endsWith('@agrivafoods.com'))
      ? admin.email
      : (env.ADMIN_NOTIFICATION_EMAIL || admin.email);

    await emailService.sendAdminPasswordResetOtpEmail({
      to: deliveryTarget,
      otp: rawOtp,
      expiresInMinutes: 10
    });

    return {
      message: 'If an eligible administrator account exists, a verification code will be sent.'
    };
  }

  static async verifyResetOtp({ email, otp }) {
    if (!email || !otp) {
      throw new ApiError(400, 'Both email and 6-digit verification code are required.');
    }
    const cleanOtp = String(otp).trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      throw new ApiError(400, 'Verification code must be exactly 6 digits.');
    }
    const normalizedEmail = email.toLowerCase().trim();

    let admin = null;
    if (checkDbConnection()) {
      admin = await User.findOne({ email: normalizedEmail, role: 'admin' });
      if (!admin && normalizedEmail === (env.ADMIN_NOTIFICATION_EMAIL || '').toLowerCase().trim()) {
        admin = await User.findOne({ role: 'admin' });
      }
    } else {
      admin = memoryStore.users.find(u => u.email === normalizedEmail && u.role === 'admin');
      if (!admin && normalizedEmail === (env.ADMIN_NOTIFICATION_EMAIL || '').toLowerCase().trim()) {
        admin = memoryStore.users.find(u => u.role === 'admin');
      }
    }

    if (!admin || !admin.resetPasswordOtpHash || !admin.resetPasswordOtpExpires) {
      throw new ApiError(400, 'Invalid or expired verification code. Please request a new code.');
    }

    // Expiration check
    if (Date.now() > new Date(admin.resetPasswordOtpExpires).getTime()) {
      admin.resetPasswordOtpHash = null;
      admin.resetPasswordOtpExpires = null;
      admin.resetPasswordOtpAttempts = 0;
      if (checkDbConnection()) await admin.save();
      throw new ApiError(400, 'Verification code has expired. Please request a new code.');
    }

    // Attempt limits check (max 5)
    if (admin.resetPasswordOtpAttempts >= 5) {
      admin.resetPasswordOtpHash = null;
      admin.resetPasswordOtpExpires = null;
      admin.resetPasswordOtpAttempts = 0;
      if (checkDbConnection()) await admin.save();
      throw new ApiError(429, 'Too many invalid attempts. This verification code has been invalidated. Please request a new code.');
    }

    // Verify OTP hash
    const candidateHash = crypto.createHash('sha256').update(cleanOtp).digest('hex');
    if (candidateHash !== admin.resetPasswordOtpHash) {
      admin.resetPasswordOtpAttempts = (admin.resetPasswordOtpAttempts || 0) + 1;
      if (admin.resetPasswordOtpAttempts >= 5) {
        admin.resetPasswordOtpHash = null;
        admin.resetPasswordOtpExpires = null;
        admin.resetPasswordOtpAttempts = 0;
        if (checkDbConnection()) await admin.save();
        throw new ApiError(429, 'Too many invalid attempts. This verification code has been invalidated. Please request a new code.');
      }
      if (checkDbConnection()) await admin.save();
      const remaining = 5 - admin.resetPasswordOtpAttempts;
      throw new ApiError(400, `Invalid verification code. ${remaining} attempt(s) remaining.`);
    }

    // OTP matched: Generate single-use resetToken
    const rawResetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(rawResetToken).digest('hex');

    admin.resetPasswordToken = resetTokenHash;
    admin.resetPasswordTokenExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    // Invalidate the OTP immediately so it cannot be reused
    admin.resetPasswordOtpHash = null;
    admin.resetPasswordOtpExpires = null;
    admin.resetPasswordOtpAttempts = 0;

    if (checkDbConnection()) {
      await admin.save();
    }

    return {
      resetToken: rawResetToken,
      message: 'Verification code confirmed. You may now set your new password.'
    };
  }

  static async resetPassword({ email, resetToken, newPassword, confirmPassword }) {
    if (!email || !resetToken || !newPassword) {
      throw new ApiError(400, 'Email, reset token, and new password are required.');
    }
    if (newPassword !== confirmPassword) {
      throw new ApiError(400, 'New passwords do not match.');
    }
    if (newPassword.length < 8) {
      throw new ApiError(400, 'Password must be at least 8 characters in length.');
    }

    const normalizedEmail = email.toLowerCase().trim();

    let admin = null;
    if (checkDbConnection()) {
      admin = await User.findOne({ email: normalizedEmail, role: 'admin' }).select('+password');
      if (!admin && normalizedEmail === (env.ADMIN_NOTIFICATION_EMAIL || '').toLowerCase().trim()) {
        admin = await User.findOne({ role: 'admin' }).select('+password');
      }
    } else {
      admin = memoryStore.users.find(u => u.email === normalizedEmail && u.role === 'admin');
      if (!admin && normalizedEmail === (env.ADMIN_NOTIFICATION_EMAIL || '').toLowerCase().trim()) {
        admin = memoryStore.users.find(u => u.role === 'admin');
      }
    }

    if (!admin || !admin.resetPasswordToken || !admin.resetPasswordTokenExpires) {
      throw new ApiError(400, 'Reset token has expired or is invalid. Please request a new verification code.');
    }

    if (Date.now() > new Date(admin.resetPasswordTokenExpires).getTime()) {
      admin.resetPasswordToken = null;
      admin.resetPasswordTokenExpires = null;
      if (checkDbConnection()) await admin.save();
      throw new ApiError(400, 'Reset token has expired. Please request a new verification code.');
    }

    const candidateTokenHash = crypto.createHash('sha256').update(String(resetToken).trim()).digest('hex');
    if (candidateTokenHash !== admin.resetPasswordToken) {
      throw new ApiError(400, 'Invalid reset token.');
    }

    // Set new password (bcrypt via pre-save hook in mongoose, or manual bcrypt in memoryStore)
    if (checkDbConnection()) {
      admin.password = newPassword;
      admin.resetPasswordToken = null;
      admin.resetPasswordTokenExpires = null;
      admin.resetPasswordOtpHash = null;
      admin.resetPasswordOtpExpires = null;
      admin.resetPasswordOtpAttempts = 0;
      await admin.save();
    } else {
      admin.password = await bcrypt.hash(newPassword, 10);
      admin.resetPasswordToken = null;
      admin.resetPasswordTokenExpires = null;
      admin.resetPasswordOtpHash = null;
      admin.resetPasswordOtpExpires = null;
      admin.resetPasswordOtpAttempts = 0;
    }

    // Send security alert
    const deliveryTarget = (admin.email && !admin.email.endsWith('@agrivafoods.com'))
      ? admin.email
      : (env.ADMIN_NOTIFICATION_EMAIL || admin.email);

    emailService.sendAdminPasswordChangedAlert({ to: deliveryTarget }).catch(err => {
      logger.error(`[AuthService] Failed to send password changed alert: ${err.message}`);
    });

    return {
      message: 'Administrator password has been reset successfully. Please sign in with your new password.'
    };
  }
}


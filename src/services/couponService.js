import { Coupon } from '../models/Coupon.js';
import { checkDbConnection } from '../config/db.js';
import { memoryStore } from '../utils/memoryStore.js';
import { ApiError } from '../utils/ApiError.js';

export class CouponService {
  static async validateCoupon(code, subtotal = 0) {
    if (!code) throw new ApiError(400, 'Coupon code is required.');
    const upperCode = code.trim().toUpperCase();

    let coupon = null;
    if (checkDbConnection()) {
      coupon = await Coupon.findOne({ code: upperCode, isActive: true });
    } else {
      coupon = memoryStore.coupons.find(c => c.code.toUpperCase() === upperCode && c.isActive);
    }

    if (!coupon) {
      throw new ApiError(404, `Coupon '${upperCode}' is invalid or expired.`);
    }

    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      throw new ApiError(400, `Coupon '${upperCode}' has expired.`);
    }

    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      throw new ApiError(400, `Coupon '${upperCode}' has reached its usage limit.`);
    }

    if (coupon.minOrderAmount && subtotal < coupon.minOrderAmount) {
      throw new ApiError(400, `Minimum order amount of ₹${coupon.minOrderAmount} required for coupon '${upperCode}'.`);
    }

    let discountAmount = 0;
    if (coupon.discountType === 'percentage') {
      discountAmount = Math.round((subtotal * coupon.discountValue) / 100);
      if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
        discountAmount = coupon.maxDiscount;
      }
    } else {
      // Fixed / flat discount
      discountAmount = coupon.discountValue;
    }

    // Discount cannot exceed subtotal
    discountAmount = Math.min(discountAmount, subtotal);

    return {
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount,
      description: coupon.description
    };
  }

  static async incrementUsage(code) {
    const upperCode = code.trim().toUpperCase();
    if (checkDbConnection()) {
      await Coupon.findOneAndUpdate({ code: upperCode }, { $inc: { usedCount: 1 } });
    } else {
      const coupon = memoryStore.coupons.find(c => c.code.toUpperCase() === upperCode);
      if (coupon) coupon.usedCount = (coupon.usedCount || 0) + 1;
    }
  }

  static async getAllCoupons() {
    if (checkDbConnection()) {
      return await Coupon.find().sort({ createdAt: -1 });
    } else {
      return memoryStore.coupons;
    }
  }

  static async createCoupon(data) {
    const code = data.code.trim().toUpperCase();
    if (checkDbConnection()) {
      const exists = await Coupon.findOne({ code });
      if (exists) throw new ApiError(409, `Coupon with code '${code}' already exists.`);
      return await Coupon.create({ ...data, code });
    } else {
      const exists = memoryStore.coupons.find(c => c.code.toUpperCase() === code);
      if (exists) throw new ApiError(409, `Coupon with code '${code}' already exists.`);
      const newCoupon = {
        _id: `coup_${Date.now()}`,
        ...data,
        code,
        usedCount: 0,
        createdAt: new Date().toISOString()
      };
      memoryStore.coupons.push(newCoupon);
      return newCoupon;
    }
  }

  static async deleteCoupon(id) {
    if (checkDbConnection()) {
      const res = await Coupon.findByIdAndDelete(id);
      if (!res) throw new ApiError(404, 'Coupon not found.');
      return { success: true, message: 'Coupon deleted successfully' };
    } else {
      const idx = memoryStore.coupons.findIndex(c => c._id === id || c.id === id);
      if (idx === -1) throw new ApiError(404, 'Coupon not found.');
      memoryStore.coupons.splice(idx, 1);
      return { success: true, message: 'Coupon deleted successfully' };
    }
  }
}

import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Please provide coupon code'],
      unique: true,
      uppercase: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    discountType: {
      type: String,
      enum: ['percentage', 'flat', 'fixed'],
      required: true,
      default: 'percentage'
    },
    discountValue: {
      type: Number,
      required: [true, 'Please provide discount value'],
      min: 0
    },
    minOrderAmount: {
      type: Number,
      default: 0
    },
    maxDiscount: {
      type: Number,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    },
    expiresAt: {
      type: Date,
      default: null
    },
    usageLimit: {
      type: Number,
      default: null
    },
    usedCount: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

export const Coupon = mongoose.model('Coupon', couponSchema);

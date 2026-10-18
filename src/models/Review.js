import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null
    },
    productName: {
      type: String,
      required: true,
      trim: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    location: {
      type: String,
      trim: true,
      default: 'India'
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    comment: {
      type: String,
      required: true
    },
    verified: {
      type: Boolean,
      default: true
    },
    helpfulCount: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['approved', 'pending', 'rejected'],
      default: 'approved'
    }
  },
  { timestamps: true }
);

reviewSchema.index({ product: 1, status: 1 });
reviewSchema.index({ productName: 1 });

export const Review = mongoose.model('Review', reviewSchema);

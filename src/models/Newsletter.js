import mongoose from 'mongoose';

const newsletterSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Please provide an email address'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
    },
    isActive: {
      type: Boolean,
      default: true
    },
    subscribedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

export const Newsletter = mongoose.model('Newsletter', newsletterSchema);

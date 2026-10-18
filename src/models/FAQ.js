import mongoose from 'mongoose';

const faqSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: [true, 'Please provide the question'],
      trim: true
    },
    answer: {
      type: String,
      required: [true, 'Please provide the answer'],
      trim: true
    },
    category: {
      type: String,
      default: 'General',
      trim: true
    },
    order: {
      type: Number,
      default: 0
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

export const FAQ = mongoose.model('FAQ', faqSchema);

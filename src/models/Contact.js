import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide your name'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Please provide your email'],
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      trim: true
    },
    subject: {
      type: String,
      trim: true,
      default: 'General Inquiry'
    },
    message: {
      type: String,
      required: [true, 'Please provide your message'],
      trim: true
    },
    status: {
      type: String,
      enum: ['new', 'in_progress', 'resolved'],
      default: 'new'
    }
  },
  { timestamps: true }
);

export const Contact = mongoose.model('Contact', contactSchema);

import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    name: { type: String, required: true },
    weight: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    image: { type: String },
    sku: { type: String },
    productSlug: { type: String }
  },
  { _id: true }
);

const timelineSchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    message: { type: String }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    customer: {
      fullName: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true, lowercase: true },
      phone: { type: String, required: true, trim: true }
    },
    shippingAddress: {
      address: { type: String, required: true },
      apartment: { type: String, default: '' },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pinCode: { type: String, required: true },
      country: { type: String, default: 'India' }
    },
    items: [orderItemSchema],
    paymentMethod: {
      type: String,
      default: 'Razorpay'
    },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Completed', 'Failed', 'Refunded', 'pending', 'completed', 'paid', 'failed', 'refunded'],
      default: 'Pending'
    },
    orderStatus: {
      type: String,
      enum: [
        'Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled',
        'pending', 'processing', 'shipped', 'delivered', 'cancelled',
        'placed', 'confirmed', 'Placed', 'Confirmed'
      ],
      default: 'Pending'
    },
    subtotal: { type: Number, required: true, min: 0 },
    shipping: { type: Number, default: 0, min: 0 },
    shippingFee: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    couponCode: { type: String, trim: true, default: null },
    trackingNumber: { type: String, trim: true, default: null },
    razorpayOrderId: { type: String, trim: true, default: null },
    razorpayPaymentId: { type: String, trim: true, default: null },
    razorpaySignature: { type: String, trim: true, default: null },
    paymentFailureReason: { type: String, default: null },
    paidAt: { type: Date, default: null },
    stockDeducted: { type: Boolean, default: false },
    webhookProcessedEvents: [{ type: String }],
    adminNotificationsSent: {
      orderCreated: { type: Boolean, default: false },
      paymentSuccess: { type: Boolean, default: false },
      paymentFailed: { type: Boolean, default: false }
    },
    timeline: [timelineSchema],
    placedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

orderSchema.index({ razorpayOrderId: 1 });
orderSchema.index({ 'customer.email': 1 });
orderSchema.index({ user: 1 });

export const Order = mongoose.model('Order', orderSchema);

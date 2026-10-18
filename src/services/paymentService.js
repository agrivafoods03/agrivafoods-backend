import Razorpay from 'razorpay';
import crypto from 'crypto';
import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { CouponService } from './couponService.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { checkDbConnection } from '../config/db.js';
import { memoryStore } from '../utils/memoryStore.js';
import { logger } from '../utils/logger.js';
import { emailService } from './emailService.js';

// Initialize Razorpay client
let razorpayClient = null;
try {
  if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
    razorpayClient = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET
    });
  }
} catch (err) {
  logger.warn('Failed to initialize Razorpay SDK client:', err.message);
}

const generateOrderNumber = () => {
  const year = new Date().getFullYear();
  const randomPart = Math.floor(10000 + Math.random() * 90000);
  return `AGR-${year}-${randomPart}`;
};

export class PaymentService {
  /**
   * Return public Razorpay configuration for frontend checkout
   */
  static getPublicConfig() {
    const isMockKey = !env.RAZORPAY_KEY_ID ||
      env.RAZORPAY_KEY_ID.includes('test_agrivafoods2026') ||
      env.RAZORPAY_KEY_ID.includes('rzp_test_your_key_id');

    return {
      keyId: env.RAZORPAY_KEY_ID || 'rzp_test_agrivafoods2026',
      currency: 'INR',
      name: 'AgrivaFoods',
      description: '100% Pure & Organic Superfoods',
      isSandboxMock: isMockKey
    };
  }

  /**
   * Validate items, stock availability, calculate trusted database pricing & discounts.
   * NEVER trust prices sent by the frontend.
   */
  static async validateAndCalculatePricing({ items, couponCode }) {
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new ApiError(400, 'Order must contain at least one product item.');
    }

    let subtotal = 0;
    const trustedItems = [];

    for (const item of items) {
      const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
      const productId = item.id || item.productId || item._id;
      const productSlug = item.slug || item.productSlug;
      const variantSku = item.sku;
      const variantWeight = item.weight;

      // 1. Fetch authoritative product from database (or memoryStore in test standalone)
      let product = null;
      if (checkDbConnection()) {
        const query = productId
          ? { _id: productId }
          : { slug: productSlug };
        product = await Product.findOne(query);
      } else {
        product = memoryStore.products.find(
          p => (productId && (p._id === productId || p.id === productId)) || (productSlug && p.slug === productSlug)
        );
      }

      if (!product) {
        throw new ApiError(404, `Product '${item.name || productSlug || productId}' not found in catalog.`);
      }

      if (!product.isActive || product.status !== 'published') {
        throw new ApiError(400, `Product '${product.name}' is currently unavailable for purchase.`);
      }

      // 2. Identify matching variant
      const variants = product.variants || [];
      let variant = null;

      if (variantSku) {
        variant = variants.find(v => v.sku === variantSku);
      }
      if (!variant && variantWeight) {
        variant = variants.find(v => v.weight?.toLowerCase() === variantWeight.toLowerCase());
      }
      if (!variant && variants.length > 0) {
        variant = variants[0];
      }

      if (!variant) {
        throw new ApiError(400, `Selected packaging/variant not found for product '${product.name}'.`);
      }

      // 3. Stock & Availability Validation
      if (variant.inStock === false || variant.stock < quantity) {
        throw new ApiError(
          400,
          `Insufficient stock for '${product.name} (${variant.weight})'. Requested: ${quantity}, Available: ${variant.stock || 0}.`
        );
      }

      // 4. Trusted Price Calculation (Using DB Price)
      const trustedPrice = Number(variant.price);
      if (isNaN(trustedPrice) || trustedPrice < 0) {
        throw new ApiError(500, `Invalid price configuration for variant ${variant.sku}.`);
      }

      const itemTotal = trustedPrice * quantity;
      subtotal += itemTotal;

      trustedItems.push({
        product: product._id || product.id,
        productSlug: product.slug,
        name: product.name,
        weight: variant.weight,
        price: trustedPrice,
        originalPrice: Number(variant.originalPrice || trustedPrice),
        quantity,
        sku: variant.sku,
        image: variant.image || (product.images && product.images[0]) || '/assets/moringa-packaging.png',
        itemTotal
      });
    }

    // Shipping rule: Free on orders >= ₹499, else standard ₹49
    const shippingFee = subtotal >= 499 ? 0 : 49;

    // Apply Coupon Discount if provided
    let discount = 0;
    let validatedCoupon = null;
    if (couponCode) {
      try {
        validatedCoupon = await CouponService.validateCoupon(couponCode, subtotal);
        discount = Number(validatedCoupon.discountAmount) || 0;
      } catch (err) {
        throw new ApiError(400, `Coupon validation failed: ${err.message}`);
      }
    }

    const total = Math.max(0, subtotal + shippingFee - discount);

    return {
      trustedItems,
      subtotal,
      shippingFee,
      discount,
      total,
      validatedCoupon
    };
  }

  /**
   * Create Razorpay Order instance with sandbox mock fallback for test environments
   */
  static async createRazorpayOrderInstance({ amountInPaise, currency = 'INR', receipt, notes = {} }) {
    if (razorpayClient && !env.RAZORPAY_KEY_ID?.includes('test_agrivafoods2026')) {
      try {
        const order = await razorpayClient.orders.create({
          amount: amountInPaise,
          currency,
          receipt,
          notes
        });
        return order;
      } catch (err) {
        logger.warn('Razorpay API call failed, using sandbox fallback:', err.message);
      }
    }

    // Deterministic test / sandbox order generator
    const mockRzpOrderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    return {
      id: mockRzpOrderId,
      entity: 'order',
      amount: amountInPaise,
      amount_paid: 0,
      amount_due: amountInPaise,
      currency,
      receipt,
      status: 'created',
      attempts: 0,
      notes,
      created_at: Math.floor(Date.now() / 1000)
    };
  }

  /**
   * Verify Razorpay payment signature
   */
  static verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return false;
    }

    const secret = env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      logger.error('RAZORPAY_KEY_SECRET is not configured.');
      return false;
    }

    const payload = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    // Also accept valid test signature in simulated sandbox mode
    const isMockValid = razorpaySignature === 'test_mock_signature' && env.NODE_ENV !== 'production';

    return expectedSignature === razorpaySignature || isMockValid;
  }

  /**
   * Verify Razorpay Webhook signature
   */
  static verifyWebhookSignature(rawBody, signature) {
    if (!signature || !rawBody) return false;
    const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) return false;

    const bodyString = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(bodyString)
      .digest('hex');

    return expectedSignature === signature;
  }

  /**
   * Create an Order with trusted pricing and create Razorpay checkout session
   */
  static async createOrderWithRazorpay({ customer, shippingAddress, items, couponCode, paymentMethod = 'Razorpay' }, userId = null) {
    if (!customer?.fullName && !customer?.name) {
      throw new ApiError(400, 'Customer name is required.');
    }
    if (!customer?.email) {
      throw new ApiError(400, 'Customer email is required.');
    }
    if (!customer?.phone) {
      throw new ApiError(400, 'Customer phone number is required.');
    }
    if (!shippingAddress?.address && !shippingAddress?.street) {
      throw new ApiError(400, 'Shipping address is required.');
    }

    const normalizedCustomer = {
      fullName: customer.fullName || customer.name,
      email: customer.email.toLowerCase().trim(),
      phone: customer.phone.trim()
    };

    const normalizedAddress = {
      address: shippingAddress.address || shippingAddress.street,
      apartment: shippingAddress.apartment || '',
      city: shippingAddress.city,
      state: shippingAddress.state,
      pinCode: shippingAddress.pinCode || shippingAddress.pincode,
      country: shippingAddress.country || 'India'
    };

    // 1. Calculate trusted prices & check stock
    const {
      trustedItems,
      subtotal,
      shippingFee,
      discount,
      total,
      validatedCoupon
    } = await this.validateAndCalculatePricing({ items, couponCode });

    const orderNumber = generateOrderNumber();
    const amountInPaise = Math.round(total * 100);

    // 2. Create Razorpay order instance
    const rzpOrder = await this.createRazorpayOrderInstance({
      amountInPaise,
      currency: 'INR',
      receipt: orderNumber,
      notes: {
        orderNumber,
        customerEmail: normalizedCustomer.email
      }
    });

    const isCod = paymentMethod.toUpperCase() === 'COD';

    // 3. Save Order in MongoDB
    const orderPayload = {
      orderNumber,
      user: userId || null,
      customer: normalizedCustomer,
      shippingAddress: normalizedAddress,
      items: trustedItems,
      subtotal,
      shipping: shippingFee,
      shippingFee,
      discount,
      couponCode: validatedCoupon ? validatedCoupon.code : null,
      total,
      paymentMethod: isCod ? 'COD' : 'Razorpay',
      paymentStatus: 'Pending',
      orderStatus: 'Pending',
      razorpayOrderId: isCod ? null : rzpOrder.id,
      stockDeducted: false,
      webhookProcessedEvents: [],
      adminNotificationsSent: {
        orderCreated: true,
        paymentSuccess: false,
        paymentFailed: false
      },
      timeline: [
        {
          status: 'Pending',
          timestamp: new Date(),
          message: isCod ? 'Order created with Cash on Delivery' : 'Order created, awaiting Razorpay payment confirmation'
        }
      ]
    };

    let order = null;
    if (checkDbConnection()) {
      order = await Order.create(orderPayload);
    } else {
      order = {
        _id: `ord_${Date.now()}`,
        ...orderPayload,
        createdAt: new Date().toISOString()
      };
      memoryStore.orders.unshift(order);
    }

    if (isCod) {
      // For COD, deduct stock immediately and mark Placed
      await this.deductStockForOrder(order);
      if (validatedCoupon) {
        await CouponService.incrementUsage(validatedCoupon.code);
      }
    }

    // Trigger admin order created email notification (non-blocking)
    emailService.sendOrderCreatedNotification(order).catch(err => {
      logger.error(`[PaymentService] Failed to send order created notification: ${err.message}`);
    });

    const isMockKey = !env.RAZORPAY_KEY_ID ||
      env.RAZORPAY_KEY_ID.includes('test_agrivafoods2026') ||
      env.RAZORPAY_KEY_ID.includes('rzp_test_your_key_id');

    return {
      order,
      razorpayOrder: isCod ? null : {
        id: rzpOrder.id,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        keyId: env.RAZORPAY_KEY_ID || 'rzp_test_agrivafoods2026',
        isSandboxMock: isMockKey
      }
    };
  }

  /**
   * Deduct stock for order items idempotently
   */
  static async deductStockForOrder(order) {
    if (!order || order.stockDeducted) {
      return; // Prevent duplicate stock deductions
    }

    if (checkDbConnection()) {
      for (const item of order.items) {
        if (!item.product) continue;
        const product = await Product.findById(item.product);
        if (!product || !product.variants) continue;

        const variant = product.variants.find(v => v.sku === item.sku || v.weight === item.weight);
        if (variant) {
          variant.stock = Math.max(0, variant.stock - item.quantity);
          variant.inStock = variant.stock > 0;
          await product.save();
        }
      }

      order.stockDeducted = true;
      await Order.updateOne({ _id: order._id }, { stockDeducted: true });
    } else {
      for (const item of order.items) {
        const prod = memoryStore.products.find(p => p._id === item.product || p.id === item.product);
        if (prod && prod.variants) {
          const variant = prod.variants.find(v => v.sku === item.sku || v.weight === item.weight);
          if (variant) {
            variant.stock = Math.max(0, variant.stock - item.quantity);
            variant.inStock = variant.stock > 0;
          }
        }
      }
      order.stockDeducted = true;
    }
  }

  /**
   * Verify client payment signature and complete order
   */
  static async verifyPaymentAndCompleteOrder({ orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      throw new ApiError(400, 'Missing Razorpay verification parameters (order_id, payment_id, or signature).');
    }

    // 1. Locate the order
    let order = null;
    if (checkDbConnection()) {
      const query = orderId
        ? { _id: orderId }
        : { razorpayOrderId };
      order = await Order.findOne(query);
    } else {
      order = memoryStore.orders.find(o => (orderId && (o._id === orderId || o.id === orderId)) || o.razorpayOrderId === razorpayOrderId);
    }

    if (!order) {
      throw new ApiError(404, 'Associated order not found for verification.');
    }

    // 2. Check if order is ALREADY completed (idempotency check)
    if (order.paymentStatus === 'Completed' || order.paymentStatus === 'paid') {
      logger.info(`Order ${order.orderNumber} is already completed. Returning existing order.`);
      return order;
    }

    // 3. Verify Razorpay cryptographic signature
    const isValid = this.verifyPaymentSignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    });

    if (!isValid) {
      order.paymentStatus = 'Failed';
      order.paymentFailureReason = 'Cryptographic signature verification failed.';

      if (!order.adminNotificationsSent) order.adminNotificationsSent = {};
      if (!order.adminNotificationsSent.paymentFailed) {
        order.adminNotificationsSent.paymentFailed = true;
        emailService.sendPaymentFailedNotification(order, 'Cryptographic signature verification failed.').catch(err => {
          logger.error(`[PaymentService] Failed to send payment failed email: ${err.message}`);
        });
      }

      if (checkDbConnection()) {
        await order.save();
      }
      throw new ApiError(400, 'Payment verification failed: Invalid payment signature.');
    }

    // 4. Update order to Completed
    order.paymentStatus = 'Completed';
    order.orderStatus = 'Processing';
    order.razorpayPaymentId = razorpayPaymentId;
    order.razorpaySignature = razorpaySignature;
    order.paidAt = new Date();

    if (!order.timeline) order.timeline = [];
    order.timeline.push({
      status: 'Paid',
      timestamp: new Date(),
      message: `Payment verified successfully via Razorpay (Payment ID: ${razorpayPaymentId})`
    });

    // 5. Deduct inventory stock idempotently
    await this.deductStockForOrder(order);

    // 6. Record coupon usage if applicable
    if (order.couponCode) {
      await CouponService.incrementUsage(order.couponCode).catch(() => {});
    }

    // 7. Send Payment Verified Admin Notification (duplicate protected)
    if (!order.adminNotificationsSent) order.adminNotificationsSent = {};
    if (!order.adminNotificationsSent.paymentSuccess) {
      order.adminNotificationsSent.paymentSuccess = true;
      emailService.sendPaymentSuccessNotification(order).catch(err => {
        logger.error(`[PaymentService] Failed to send payment success email: ${err.message}`);
      });
    }

    if (checkDbConnection()) {
      await order.save();
    }

    logger.info(`Order ${order.orderNumber} successfully paid and verified.`);
    return order;
  }

  /**
   * Handle Razorpay Webhooks idempotently
   */
  static async handleWebhookEvent(eventPayload, signature) {
    // 1. Verify webhook signature
    const isValid = this.verifyWebhookSignature(eventPayload, signature);
    if (!isValid) {
      logger.warn('Rejected invalid Razorpay webhook signature.');
      throw new ApiError(400, 'Invalid webhook signature.');
    }

    let event = null;
    if (Buffer.isBuffer(eventPayload)) {
      event = JSON.parse(eventPayload.toString('utf8'));
    } else if (typeof eventPayload === 'string') {
      event = JSON.parse(eventPayload);
    } else {
      event = eventPayload;
    }
    const eventType = event?.event;
    const eventId = event?.id;

    logger.info(`Processing Razorpay webhook event: ${eventType} (${eventId})`);

    // 2. Handle Payment Captured or Order Paid
    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      const paymentEntity = event.payload?.payment?.entity;
      const orderEntity = event.payload?.order?.entity;

      const rzpOrderId = paymentEntity?.order_id || orderEntity?.id;
      const rzpPaymentId = paymentEntity?.id;

      if (!rzpOrderId) return { status: 'ignored', reason: 'No order_id in event payload' };

      let order = null;
      if (checkDbConnection()) {
        order = await Order.findOne({ razorpayOrderId: rzpOrderId });
      } else {
        order = memoryStore.orders.find(o => o.razorpayOrderId === rzpOrderId);
      }

      if (!order) {
        logger.warn(`Webhook: Order with razorpayOrderId '${rzpOrderId}' not found.`);
        return { status: 'not_found' };
      }

      // Idempotency: Check if this event was already processed or order is already completed
      if (order.webhookProcessedEvents?.includes(eventId)) {
        logger.info(`Webhook event ${eventId} already processed for order ${order.orderNumber}.`);
        return { status: 'already_processed' };
      }

      if (order.paymentStatus !== 'Completed') {
        order.paymentStatus = 'Completed';
        order.orderStatus = 'Processing';
        if (rzpPaymentId) order.razorpayPaymentId = rzpPaymentId;
        order.paidAt = new Date();
        await this.deductStockForOrder(order);

        if (!order.timeline) order.timeline = [];
        order.timeline.push({
          status: 'Paid',
          timestamp: new Date(),
          message: `Payment confirmed via Razorpay Webhook (${eventType})`
        });
      }

      if (!order.webhookProcessedEvents) order.webhookProcessedEvents = [];
      order.webhookProcessedEvents.push(eventId);

      // Trigger admin payment success notification (duplicate protected)
      if (!order.adminNotificationsSent) order.adminNotificationsSent = {};
      if (!order.adminNotificationsSent.paymentSuccess) {
        order.adminNotificationsSent.paymentSuccess = true;
        emailService.sendPaymentSuccessNotification(order).catch(err => {
          logger.error(`[PaymentService] Failed to send webhook payment success email: ${err.message}`);
        });
      }

      if (checkDbConnection()) {
        await order.save();
      }

      return { status: 'processed', orderNumber: order.orderNumber };
    }

    // 3. Handle Payment Failed
    if (eventType === 'payment.failed') {
      const paymentEntity = event.payload?.payment?.entity;
      const rzpOrderId = paymentEntity?.order_id;
      const errorDescription = paymentEntity?.error_description || 'Payment failed';

      if (rzpOrderId) {
        let order = null;
        if (checkDbConnection()) {
          order = await Order.findOne({ razorpayOrderId: rzpOrderId });
        } else {
          order = memoryStore.orders.find(o => o.razorpayOrderId === rzpOrderId);
        }

        if (order && order.paymentStatus !== 'Completed') {
          order.paymentStatus = 'Failed';
          order.paymentFailureReason = errorDescription;

          if (!order.adminNotificationsSent) order.adminNotificationsSent = {};
          if (!order.adminNotificationsSent.paymentFailed) {
            order.adminNotificationsSent.paymentFailed = true;
            emailService.sendPaymentFailedNotification(order, errorDescription).catch(err => {
              logger.error(`[PaymentService] Failed to send webhook payment failed email: ${err.message}`);
            });
          }

          if (checkDbConnection()) await order.save();
        }
      }
      return { status: 'failed_recorded' };
    }

    return { status: 'unhandled_event' };
  }
}

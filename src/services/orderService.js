import { Order } from '../models/Order.js';
import { checkDbConnection } from '../config/db.js';
import { memoryStore } from '../utils/memoryStore.js';
import { ApiError } from '../utils/ApiError.js';
import { CouponService } from './couponService.js';
import { emailService } from './emailService.js';
import { logger } from '../utils/logger.js';

const generateOrderNumber = () => {
  const year = new Date().getFullYear();
  const randomPart = Math.floor(10000 + Math.random() * 90000);
  return `AGR-${year}-${randomPart}`;
};

export class OrderService {
  static async createOrder(orderData, userId = null) {
    const { customer, shippingAddress, items, paymentMethod = 'COD', couponCode } = orderData;

    if (!customer?.name || !customer?.email || !customer?.phone) {
      throw new ApiError(400, 'Customer name, email, and phone are required.');
    }
    if (!shippingAddress?.street || !shippingAddress?.city || !shippingAddress?.state || !shippingAddress?.pincode) {
      throw new ApiError(400, 'Complete shipping address is required.');
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new ApiError(400, 'Order must contain at least one product item.');
    }

    // Calculate subtotal
    let subtotal = 0;
    const processedItems = items.map(item => {
      const price = Number(item.price);
      const quantity = Number(item.quantity) || 1;
      const itemTotal = price * quantity;
      subtotal += itemTotal;
      return {
        productSlug: item.productSlug,
        productName: item.productName || item.name,
        weight: item.weight,
        price,
        quantity,
        itemTotal
      };
    });

    // Shipping fee rule: Free if subtotal >= 499, else 49
    let shippingFee = subtotal >= 499 ? 0 : 49;

    // Apply coupon if provided
    let discount = 0;
    let validatedCoupon = null;
    if (couponCode) {
      try {
        validatedCoupon = await CouponService.validateCoupon(couponCode, subtotal);
        discount = validatedCoupon.discountAmount;
      } catch (err) {
        throw new ApiError(400, `Invalid coupon: ${err.message}`);
      }
    }

    const total = Math.max(0, subtotal + shippingFee - discount);
    const orderNumber = generateOrderNumber();

    const orderPayload = {
      orderNumber,
      user: userId || null,
      customer,
      shippingAddress,
      items: processedItems,
      subtotal,
      shippingFee,
      discount,
      couponCode: couponCode ? couponCode.toUpperCase() : null,
      total,
      paymentMethod,
      paymentStatus: paymentMethod === 'COD' ? 'pending' : 'paid',
      orderStatus: 'placed',
      adminNotificationsSent: {
        orderCreated: true,
        paymentSuccess: paymentMethod !== 'COD',
        paymentFailed: false
      },
      timeline: [
        { status: 'placed', timestamp: new Date(), message: 'Order has been placed successfully.' }
      ]
    };

    let order = null;
    if (checkDbConnection()) {
      order = await Order.create(orderPayload);
      if (couponCode) {
        await CouponService.incrementUsage(couponCode);
      }
    } else {
      order = {
        _id: `ord_${Date.now()}`,
        ...orderPayload,
        createdAt: new Date().toISOString()
      };
      memoryStore.orders.unshift(order);
      if (couponCode) {
        await CouponService.incrementUsage(couponCode);
      }
    }

    // Trigger admin order created email notification (non-blocking)
    emailService.sendOrderCreatedNotification(order).catch(err => {
      logger.error(`[OrderService] Failed to send order created notification: ${err.message}`);
    });

    return order;
  }

  static async getOrderById(orderId, userId = null) {
    if (checkDbConnection()) {
      const order = await Order.findById(orderId);
      if (!order) throw new ApiError(404, 'Order not found.');
      if (userId && order.user && order.user.toString() !== userId.toString()) {
        throw new ApiError(403, 'Unauthorized access to this order.');
      }
      return order;
    } else {
      const order = memoryStore.orders.find(o => o._id === orderId || o.id === orderId);
      if (!order) throw new ApiError(404, 'Order not found.');
      if (userId && order.user && order.user.toString() !== userId.toString()) {
        throw new ApiError(403, 'Unauthorized access to this order.');
      }
      return order;
    }
  }

  static async getOrderByNumber(orderNumber) {
    if (checkDbConnection()) {
      const order = await Order.findOne({ orderNumber });
      if (!order) throw new ApiError(404, `Order ${orderNumber} not found.`);
      return order;
    } else {
      const order = memoryStore.orders.find(o => o.orderNumber.toUpperCase() === orderNumber.toUpperCase());
      if (!order) throw new ApiError(404, `Order ${orderNumber} not found.`);
      return order;
    }
  }

  static async getUserOrders(userId) {
    if (checkDbConnection()) {
      return await Order.find({ user: userId }).sort({ createdAt: -1 });
    } else {
      return memoryStore.orders.filter(o => o.user && o.user.toString() === userId.toString());
    }
  }

  static async getAllOrders({ page = 1, limit = 20, status, search }) {
    if (checkDbConnection()) {
      const query = {};
      if (status && status !== 'All') {
        query.orderStatus = { $regex: new RegExp(`^${status}$`, 'i') };
      }
      if (search) {
        query.$or = [
          { orderNumber: { $regex: search, $options: 'i' } },
          { 'customer.name': { $regex: search, $options: 'i' } },
          { 'customer.email': { $regex: search, $options: 'i' } },
          { 'customer.phone': { $regex: search, $options: 'i' } }
        ];
      }

      const skip = (page - 1) * limit;
      const total = await Order.countDocuments(query);
      const orders = await Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit));

      return { orders, total, page: Number(page), pages: Math.ceil(total / limit) };
    } else {
      let orders = [...memoryStore.orders];
      if (status && status !== 'All') {
        orders = orders.filter(o => o.orderStatus && o.orderStatus.toLowerCase() === status.toLowerCase());
      }
      if (search) {
        const q = search.toLowerCase();
        orders = orders.filter(o =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.customer.name.toLowerCase().includes(q) ||
          o.customer.email.toLowerCase().includes(q) ||
          o.customer.phone.toLowerCase().includes(q)
        );
      }
      const total = orders.length;
      const skip = (page - 1) * limit;
      const paginated = orders.slice(skip, skip + Number(limit));

      return { orders: paginated, total, page: Number(page), pages: Math.ceil(total / limit) };
    }
  }

  static async updateOrderStatus(orderId, { orderStatus, paymentStatus, trackingNumber }) {
    if (checkDbConnection()) {
      const order = await Order.findById(orderId);
      if (!order) throw new ApiError(404, 'Order not found.');

      if (orderStatus && orderStatus.toLowerCase() !== (order.orderStatus || '').toLowerCase()) {
        order.orderStatus = orderStatus;
        if (!order.timeline) order.timeline = [];
        order.timeline.push({
          status: orderStatus,
          timestamp: new Date(),
          message: `Order status changed to ${orderStatus}`
        });

        // If it's a COD order and delivered without passing an explicit paymentStatus, auto-mark Completed
        if (
          order.paymentMethod?.toUpperCase() === 'COD' &&
          orderStatus.toLowerCase() === 'delivered' &&
          !paymentStatus &&
          order.paymentStatus?.toLowerCase() !== 'completed'
        ) {
          order.paymentStatus = 'Completed';
          if (!order.paidAt) order.paidAt = new Date();
          order.timeline.push({
            status: 'Completed',
            timestamp: new Date(),
            message: 'Cash collected upon delivery (COD Completed)'
          });
        }
      }
      if (paymentStatus) {
        order.paymentStatus = paymentStatus;
        if ((paymentStatus.toLowerCase() === 'completed' || paymentStatus.toLowerCase() === 'paid') && !order.paidAt) {
          order.paidAt = new Date();
        }
      }
      if (trackingNumber !== undefined) order.trackingNumber = trackingNumber;

      await order.save();
      return order;
    } else {
      const order = memoryStore.orders.find(o => o._id === orderId || o.id === orderId);
      if (!order) throw new ApiError(404, 'Order not found.');

      if (orderStatus && orderStatus.toLowerCase() !== (order.orderStatus || '').toLowerCase()) {
        order.orderStatus = orderStatus;
        if (!order.timeline) order.timeline = [];
        order.timeline.push({
          status: orderStatus,
          timestamp: new Date().toISOString(),
          message: `Order status changed to ${orderStatus}`
        });

        // If it's a COD order and delivered without passing an explicit paymentStatus, auto-mark Completed
        if (
          order.paymentMethod?.toUpperCase() === 'COD' &&
          orderStatus.toLowerCase() === 'delivered' &&
          !paymentStatus &&
          order.paymentStatus?.toLowerCase() !== 'completed'
        ) {
          order.paymentStatus = 'Completed';
          if (!order.paidAt) order.paidAt = new Date().toISOString();
          order.timeline.push({
            status: 'Completed',
            timestamp: new Date().toISOString(),
            message: 'Cash collected upon delivery (COD Completed)'
          });
        }
      }
      if (paymentStatus) {
        order.paymentStatus = paymentStatus;
        if ((paymentStatus.toLowerCase() === 'completed' || paymentStatus.toLowerCase() === 'paid') && !order.paidAt) {
          order.paidAt = new Date().toISOString();
        }
      }
      if (trackingNumber !== undefined) order.trackingNumber = trackingNumber;

      return order;
    }
  }
}

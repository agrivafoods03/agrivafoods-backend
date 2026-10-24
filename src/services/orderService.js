import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
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

    // Enforce Cash on Delivery only
    if (
      paymentMethod &&
      paymentMethod.toUpperCase() !== 'COD' &&
      paymentMethod.toLowerCase() !== 'cash on delivery'
    ) {
      throw new ApiError(
        400,
        'Online payments are temporarily disabled. AgrivaFoods currently accepts Cash on Delivery (COD) only.'
      );
    }

    const customerName = customer?.fullName || customer?.name;
    if (!customerName || !customer?.email || !customer?.phone) {
      throw new ApiError(400, 'Customer name, email, and phone are required.');
    }

    const street = shippingAddress?.address || shippingAddress?.street;
    const pinCode = shippingAddress?.pinCode || shippingAddress?.pincode;
    if (!street || !shippingAddress?.city || !shippingAddress?.state || !pinCode) {
      throw new ApiError(400, 'Complete shipping address (address, city, state, pinCode) is required.');
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new ApiError(400, 'Order must contain at least one product item.');
    }

    // Authoritative pricing & stock verification
    let subtotal = 0;
    const processedItems = [];

    for (const item of items) {
      const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
      const productId = item.productId || item.id || item._id;
      const productSlug = item.productSlug || item.slug;

      let product = null;
      if (checkDbConnection()) {
        const query = productId ? { _id: productId } : { slug: productSlug };
        product = await Product.findOne(query);
      } else {
        product = memoryStore.products?.find(
          p => (productId && (p._id === productId || p.id === productId)) || (productSlug && p.slug === productSlug)
        );
      }

      let trustedPrice = Number(item.price);
      let variantSku = item.sku;
      let variantWeight = item.weight || 'Standard';
      let itemImage = item.image;

      if (product) {
        if (!product.isActive || product.status !== 'published') {
          throw new ApiError(400, `Product '${product.name}' is currently unavailable for purchase.`);
        }

        const variants = product.variants || [];
        let variant = null;
        if (item.sku) {
          variant = variants.find(v => v.sku === item.sku);
        }
        if (!variant && item.weight) {
          variant = variants.find(v => v.weight?.toLowerCase() === item.weight.toLowerCase());
        }
        if (!variant && variants.length > 0) {
          variant = variants[0];
        }

        if (variant) {
          if (variant.inStock === false || variant.stock < quantity) {
            throw new ApiError(
              400,
              `Insufficient stock for '${product.name} (${variant.weight})'. Requested: ${quantity}, Available: ${variant.stock || 0}.`
            );
          }
          trustedPrice = Number(variant.price);
          variantSku = variant.sku;
          variantWeight = variant.weight;
          itemImage = variant.image || (product.images && product.images[0]) || itemImage;
        }
      }

      if (isNaN(trustedPrice) || trustedPrice < 0) {
        throw new ApiError(400, `Invalid price configuration for product item.`);
      }

      const itemTotal = trustedPrice * quantity;
      subtotal += itemTotal;

      processedItems.push({
        product: product ? (product._id || product.id) : null,
        productSlug: product ? product.slug : productSlug,
        name: product ? product.name : (item.productName || item.name),
        productName: product ? product.name : (item.productName || item.name),
        weight: variantWeight,
        price: trustedPrice,
        quantity,
        sku: variantSku,
        image: itemImage || '/assets/moringa-packaging.png',
        itemTotal
      });
    }

    // Shipping fee rule: Free if subtotal >= 499, else standard ₹49
    const shippingFee = subtotal >= 499 ? 0 : 49;

    // Apply coupon if provided
    let discount = 0;
    let validatedCoupon = null;
    if (couponCode) {
      try {
        validatedCoupon = await CouponService.validateCoupon(couponCode, subtotal);
        discount = Number(validatedCoupon.discountAmount) || 0;
      } catch (err) {
        throw new ApiError(400, `Invalid coupon: ${err.message}`);
      }
    }

    const total = Math.max(0, subtotal + shippingFee - discount);
    const orderNumber = generateOrderNumber();

    const orderPayload = {
      orderNumber,
      user: userId || null,
      customer: {
        fullName: customerName,
        name: customerName,
        email: customer.email.trim().toLowerCase(),
        phone: customer.phone.trim()
      },
      shippingAddress: {
        address: street,
        street,
        apartment: shippingAddress.apartment || '',
        city: shippingAddress.city.trim(),
        state: shippingAddress.state.trim(),
        pinCode: String(pinCode).trim(),
        pincode: String(pinCode).trim(),
        country: shippingAddress.country || 'India'
      },
      items: processedItems,
      subtotal,
      shipping: shippingFee,
      shippingFee,
      discount,
      couponCode: validatedCoupon ? validatedCoupon.code : (couponCode ? couponCode.toUpperCase() : null),
      total,
      paymentMethod: 'COD',
      paymentStatus: 'Pending', // Unpaid: Payment due upon delivery
      orderStatus: 'Placed',
      stockDeducted: true,
      paidAt: null,
      razorpayOrderId: null,
      razorpayPaymentId: null,
      razorpaySignature: null,
      adminNotificationsSent: {
        orderCreated: true,
        paymentSuccess: false,
        paymentFailed: false
      },
      timeline: [
        {
          status: 'Placed',
          timestamp: new Date(),
          message: 'Order placed successfully with Cash on Delivery (payment due upon arrival).'
        }
      ]
    };

    let order = null;
    if (checkDbConnection()) {
      order = await Order.create(orderPayload);
      if (validatedCoupon) {
        await CouponService.incrementUsage(validatedCoupon.code);
      }

      // Deduct inventory stock for placed COD order
      for (const item of processedItems) {
        if (!item.product) continue;
        const prod = await Product.findById(item.product);
        if (!prod || !prod.variants) continue;
        const v = prod.variants.find(varItem => varItem.sku === item.sku || varItem.weight === item.weight);
        if (v) {
          v.stock = Math.max(0, v.stock - item.quantity);
          v.inStock = v.stock > 0;
          await prod.save();
        }
      }
    } else {
      order = {
        _id: `ord_${Date.now()}`,
        ...orderPayload,
        createdAt: new Date().toISOString()
      };
      memoryStore.orders.unshift(order);
      if (validatedCoupon) {
        await CouponService.incrementUsage(validatedCoupon.code);
      }

      // Memory store stock deduction
      for (const item of processedItems) {
        const prod = memoryStore.products?.find(p => p._id === item.product || p.id === item.product);
        if (prod && prod.variants) {
          const v = prod.variants.find(varItem => varItem.sku === item.sku || varItem.weight === item.weight);
          if (v) {
            v.stock = Math.max(0, v.stock - item.quantity);
            v.inStock = v.stock > 0;
          }
        }
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

import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { User } from '../models/User.js';
import { Contact } from '../models/Contact.js';
import { Review } from '../models/Review.js';
import { checkDbConnection } from '../config/db.js';
import { memoryStore } from '../utils/memoryStore.js';

export class DashboardService {
  static async getStats() {
    if (checkDbConnection()) {
      const [
        totalOrders,
        totalProducts,
        activeProducts,
        totalCustomers,
        totalInquiries,
        totalReviews,
        recentOrders,
        recentProducts,
        revenueData,
        statusCounts,
        reviews
      ] = await Promise.all([
        Order.countDocuments(),
        Product.countDocuments(),
        Product.countDocuments({ isActive: true, status: 'published' }),
        User.countDocuments({ role: 'customer' }),
        Contact.countDocuments(),
        Review.countDocuments(),
        Order.find().sort({ createdAt: -1 }).limit(5),
        Product.find().sort({ updatedAt: -1 }).limit(5),
        Order.aggregate([
          { $match: { paymentStatus: { $in: ['paid', 'Completed'] } } },
          { $group: { _id: null, totalRevenue: { $sum: '$total' } } }
        ]),
        Order.aggregate([
          { $group: { _id: '$orderStatus', count: { $sum: 1 } } }
        ]),
        Review.find()
      ]);

      const totalRevenue = revenueData.length > 0 ? revenueData[0].totalRevenue : 0;
      const orderStatusMap = statusCounts.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {});

      // Calculate low stock & out of stock products
      const allProducts = await Product.find();
      let outOfStockCount = 0;
      let lowStockCount = 0;
      for (const p of allProducts) {
        const variants = p.variants || [];
        const isOut = variants.every(v => v.stock === 0);
        const isLow = variants.some(v => v.stock <= 10 && v.stock > 0);
        if (isOut) outOfStockCount++;
        if (isLow) lowStockCount++;
      }

      // Review stats
      const approvedReviews = reviews.filter(r => r.status === 'approved' || !r.status);
      const pendingReviews = reviews.filter(r => r.status === 'pending');
      const avgRating = approvedReviews.length > 0
        ? Math.round((approvedReviews.reduce((sum, r) => sum + r.rating, 0) / approvedReviews.length) * 10) / 10
        : 5.0;

      return {
        overview: {
          totalRevenue,
          totalOrders,
          totalCustomers,
          totalProducts,
          activeProducts,
          outOfStockProducts: outOfStockCount,
          lowStockProducts: lowStockCount,
          totalReviews,
          pendingReviews: pendingReviews.length,
          avgRating,
          totalInquiries
        },
        orderStatusDistribution: orderStatusMap,
        recentOrders,
        recentProducts,
        recentReviews: reviews.slice(0, 5)
      };
    } else {
      // In-Memory Mode
      const totalOrders = memoryStore.orders.length;
      const totalProducts = memoryStore.products.length;
      const activeProducts = memoryStore.products.filter(p => p.isActive !== false && p.status !== 'draft' && p.status !== 'archived').length;
      const totalCustomers = memoryStore.users.filter(u => u.role === 'customer').length;
      const totalInquiries = memoryStore.contacts.length;
      const totalReviews = memoryStore.reviews.length;

      let outOfStockCount = 0;
      let lowStockCount = 0;
      for (const p of memoryStore.products) {
        const variants = p.variants || [];
        const isOut = variants.every(v => v.stock === 0);
        const isLow = variants.some(v => v.stock <= 10 && v.stock > 0);
        if (isOut) outOfStockCount++;
        if (isLow) lowStockCount++;
      }

      const totalRevenue = memoryStore.orders
        .filter(o => o.paymentStatus === 'paid' || o.paymentStatus === 'Completed')
        .reduce((sum, o) => sum + (o.total || 0), 0);

      const orderStatusMap = memoryStore.orders.reduce((acc, o) => {
        acc[o.orderStatus] = (acc[o.orderStatus] || 0) + 1;
        return acc;
      }, {});

      const approvedReviews = memoryStore.reviews.filter(r => r.status === 'approved' || !r.status);
      const pendingReviews = memoryStore.reviews.filter(r => r.status === 'pending');
      const avgRating = approvedReviews.length > 0
        ? Math.round((approvedReviews.reduce((sum, r) => sum + r.rating, 0) / approvedReviews.length) * 10) / 10
        : 5.0;

      const recentOrders = memoryStore.orders.slice(0, 5);
      const recentProducts = memoryStore.products.slice(0, 5);
      const recentReviews = memoryStore.reviews.slice(0, 5);

      return {
        overview: {
          totalRevenue,
          totalOrders,
          totalCustomers,
          totalProducts,
          activeProducts,
          outOfStockProducts: outOfStockCount,
          lowStockProducts: lowStockCount,
          totalReviews,
          pendingReviews: pendingReviews.length,
          avgRating,
          totalInquiries
        },
        orderStatusDistribution: orderStatusMap,
        recentOrders,
        recentProducts,
        recentReviews
      };
    }
  }
}

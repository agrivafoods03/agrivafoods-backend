import { Router } from 'express';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import productRoutes from './productRoutes.js';
import orderRoutes from './orderRoutes.js';
import reviewRoutes from './reviewRoutes.js';
import contactRoutes from './contactRoutes.js';
import newsletterRoutes from './newsletterRoutes.js';
import faqRoutes from './faqRoutes.js';
import couponRoutes from './couponRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';
import categoryRoutes from './categoryRoutes.js';
import homepageRoutes from './homepageRoutes.js';
import mediaRoutes from './mediaRoutes.js';
import adminRoutes from './adminRoutes.js';
import paymentRoutes from './paymentRoutes.js';
import { checkDbConnection } from '../config/db.js';
import { ApiResponse } from '../utils/ApiResponse.js';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  const isDbConnected = checkDbConnection();
  return ApiResponse.success(res, {
    status: 'online',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: isDbConnected ? 'connected' : 'in-memory-fallback',
    environment: process.env.NODE_ENV || 'development',
    notifications: {
      adminEmail: process.env.ADMIN_NOTIFICATION_EMAIL || 'admin@agrivafoods.com',
      smtpConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
    }
  }, 'AgrivaFoods API is running smoothly');
});

// Resource sub-routers
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/homepage', homepageRoutes);
router.use('/media', mediaRoutes);
router.use('/orders', orderRoutes);
router.use('/payment', paymentRoutes);
router.use('/reviews', reviewRoutes);
router.use('/contact', contactRoutes);
router.use('/newsletter', newsletterRoutes);
router.use('/faqs', faqRoutes);
router.use('/coupons', couponRoutes);
router.use('/dashboard', dashboardRoutes);

// Dedicated Admin Router
router.use('/admin', adminRoutes);

export default router;

import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/authMiddleware.js';
import { login, logout, getMe } from '../controllers/authController.js';
import { getStats } from '../controllers/dashboardController.js';
import {
  getAdminProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  togglePublish,
  toggleFeatured,
  getInventory,
  updateVariantStock
} from '../controllers/productController.js';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory
} from '../controllers/categoryController.js';
import {
  getReviews,
  updateReviewStatus,
  deleteReview
} from '../controllers/reviewController.js';
import {
  getHomepageConfig,
  updateHomepageConfig
} from '../controllers/homepageController.js';
import {
  getAllMedia,
  uploadMedia,
  deleteMedia
} from '../controllers/mediaController.js';
import {
  getAllOrders,
  updateOrderStatus
} from '../controllers/orderController.js';
import { upload } from '../middlewares/uploadMiddleware.js';
import { authLimiter } from '../middlewares/rateLimiter.js';
import { validateBody } from '../middlewares/validateMiddleware.js';
import { emailService } from '../services/emailService.js';
import { env } from '../config/env.js';
import { ApiResponse } from '../utils/ApiResponse.js';

const router = Router();

// 1. Admin Authentication
router.post('/auth/login', authLimiter, validateBody(['email', 'password']), login);
router.post('/auth/logout', authenticate, authorize('admin'), logout);
router.get('/auth/me', authenticate, authorize('admin'), getMe);

// 2. Admin Dashboard Overview
router.get('/dashboard', authenticate, authorize('admin'), getStats);

// 3. Admin Product Management
router.get('/products', authenticate, authorize('admin'), getAdminProducts);
router.post('/products', authenticate, authorize('admin'), validateBody(['name']), createProduct);
router.get('/products/:id', authenticate, authorize('admin'), getProductById);
router.put('/products/:id', authenticate, authorize('admin'), updateProduct);
router.delete('/products/:id', authenticate, authorize('admin'), deleteProduct);
router.patch('/products/:id/toggle-publish', authenticate, authorize('admin'), togglePublish);
router.patch('/products/:id/featured', authenticate, authorize('admin'), toggleFeatured);

// 4. Inventory Management
router.get('/inventory', authenticate, authorize('admin'), getInventory);
router.patch('/inventory/:productId/variant/:sku', authenticate, authorize('admin'), updateVariantStock);

// 5. Category Management
router.get('/categories', authenticate, authorize('admin'), getCategories);
router.post('/categories', authenticate, authorize('admin'), validateBody(['name']), createCategory);
router.put('/categories/:id', authenticate, authorize('admin'), updateCategory);
router.delete('/categories/:id', authenticate, authorize('admin'), deleteCategory);

// 6. Review Moderation
router.get('/reviews', authenticate, authorize('admin'), getReviews);
router.patch('/reviews/:id/status', authenticate, authorize('admin'), updateReviewStatus);
router.delete('/reviews/:id', authenticate, authorize('admin'), deleteReview);

// 7. Homepage & Site Content Management
router.get('/homepage', authenticate, authorize('admin'), getHomepageConfig);
router.put('/homepage', authenticate, authorize('admin'), updateHomepageConfig);

// 8. Media & Image Management
router.get('/media', authenticate, authorize('admin'), getAllMedia);
router.post('/media/upload', authenticate, authorize('admin'), upload.array('images', 10), uploadMedia);
router.delete('/media/:filename', authenticate, authorize('admin'), deleteMedia);

// 9. Orders Management
router.get('/orders', authenticate, authorize('admin'), getAllOrders);
router.put('/orders/:id/status', authenticate, authorize('admin'), updateOrderStatus);

// 10. Admin Email Notification Diagnostics
router.get('/notifications/status', authenticate, authorize('admin'), async (req, res) => {
  const connection = await emailService.verifyConnection();
  return ApiResponse.success(res, {
    adminEmail: env.ADMIN_NOTIFICATION_EMAIL,
    fromEmail: env.SMTP_FROM_EMAIL,
    smtpHost: env.SMTP_HOST || 'Not configured (Mock / Log mode)',
    smtpPort: env.SMTP_PORT,
    smtpSecure: env.SMTP_SECURE,
    connection
  }, 'Notification service status');
});

router.post('/notifications/test', authenticate, authorize('admin'), async (req, res) => {
  const testSubject = '[AgrivaFoods Admin] System Test Notification';
  const testHtml = emailService.renderEmailLayout({
    badgeText: 'Diagnostic Test',
    badgeColor: '#15803d',
    title: 'Admin Email Notification Test',
    subtitle: 'This is a test notification confirming that email alerts are operational.',
    contentHtml: `
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        <p style="margin: 0; color: #166534; font-size: 14px;">
          ✓ The automatic notification system is operational. Whenever a product is added or updated, a customer registers, an order is placed, or a payment succeeds/fails, you will receive an alert.
        </p>
      </div>
    `,
    ctaText: 'Open Admin Dashboard',
    ctaUrl: '/admin/dashboard'
  });

  const testText = `
=== AGRIVAFOODS ADMIN: SYSTEM TEST NOTIFICATION ===

This is a test notification verifying that administrative email alerts are working properly.
All notification types are active:
- Product Added
- Product Updated
- Customer Registration
- New Order Placed
- Payment Verified
- Payment Failed
- Customer Inquiry
  `.trim();

  const result = await emailService.sendAdminEmail({
    subject: testSubject,
    html: testHtml,
    text: testText
  });

  return ApiResponse.success(res, result, 'Test notification dispatched');
});

export default router;

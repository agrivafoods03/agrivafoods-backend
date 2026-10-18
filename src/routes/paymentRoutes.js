import { Router } from 'express';
import {
  getPaymentConfig,
  createRazorpayOrder,
  verifyRazorpayPayment,
  handleRazorpayWebhook
} from '../controllers/paymentController.js';
import { optionalAuth } from '../middlewares/authMiddleware.js';
import { validateBody } from '../middlewares/validateMiddleware.js';

const router = Router();

// 1. Public Payment Config (key ID)
router.get('/config', getPaymentConfig);

// 2. Create Order & Razorpay Checkout Session
router.post(
  '/create-order',
  optionalAuth,
  validateBody(['customer', 'shippingAddress', 'items']),
  createRazorpayOrder
);

// 3. Verify Payment Signature
router.post(
  '/verify',
  validateBody(['razorpayOrderId', 'razorpayPaymentId', 'razorpaySignature']),
  verifyRazorpayPayment
);

// 4. Razorpay Webhook Event Listener
router.post('/webhook', handleRazorpayWebhook);

export default router;

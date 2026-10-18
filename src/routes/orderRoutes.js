import { Router } from 'express';
import {
  createOrder,
  getOrderById,
  getOrderByNumber,
  getMyOrders,
  getAllOrders,
  updateOrderStatus
} from '../controllers/orderController.js';
import { authenticate, optionalAuth, authorize } from '../middlewares/authMiddleware.js';
import { validateBody } from '../middlewares/validateMiddleware.js';

const router = Router();

// Order creation (supports both guest and authenticated users)
router.post('/', optionalAuth, validateBody(['customer', 'shippingAddress', 'items']), createOrder);

// Customer specific orders
router.get('/my-orders', authenticate, getMyOrders);

// Public Order Tracking
router.get('/track/:orderNumber', getOrderByNumber);

// Admin order management
router.get('/', authenticate, authorize('admin'), getAllOrders);
router.put('/:id/status', authenticate, authorize('admin'), updateOrderStatus);

// Order details by ID (authenticated user or admin)
router.get('/:id', optionalAuth, getOrderById);

export default router;

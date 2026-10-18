import { Router } from 'express';
import { validateCoupon, getAllCoupons, createCoupon, deleteCoupon } from '../controllers/couponController.js';
import { authenticate, authorize } from '../middlewares/authMiddleware.js';
import { validateBody } from '../middlewares/validateMiddleware.js';

const router = Router();

// Validate coupon for checkout (Public)
router.post('/validate', validateBody(['code']), validateCoupon);

// Admin Coupon management
router.get('/', authenticate, authorize('admin'), getAllCoupons);
router.post('/', authenticate, authorize('admin'), validateBody(['code', 'discountValue']), createCoupon);
router.delete('/:id', authenticate, authorize('admin'), deleteCoupon);

export default router;

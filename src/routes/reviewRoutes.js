import { Router } from 'express';
import {
  getReviews,
  createReview,
  upvoteReview,
  updateReviewStatus,
  deleteReview
} from '../controllers/reviewController.js';
import { authenticate, optionalAuth, authorize } from '../middlewares/authMiddleware.js';
import { validateBody } from '../middlewares/validateMiddleware.js';

const router = Router();

// Public review operations
router.get('/', getReviews);
router.post('/', optionalAuth, validateBody(['name', 'rating', 'comment', 'productName']), createReview);
router.post('/:id/upvote', upvoteReview);

// Admin review moderation
router.put('/:id/status', authenticate, authorize('admin'), updateReviewStatus);
router.delete('/:id', authenticate, authorize('admin'), deleteReview);

export default router;

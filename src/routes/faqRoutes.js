import { Router } from 'express';
import { getFAQs, createFAQ, updateFAQ, deleteFAQ } from '../controllers/faqController.js';
import { authenticate, authorize } from '../middlewares/authMiddleware.js';
import { validateBody } from '../middlewares/validateMiddleware.js';

const router = Router();

// Public FAQs
router.get('/', getFAQs);

// Admin FAQs management
router.post('/', authenticate, authorize('admin'), validateBody(['question', 'answer']), createFAQ);
router.put('/:id', authenticate, authorize('admin'), updateFAQ);
router.delete('/:id', authenticate, authorize('admin'), deleteFAQ);

export default router;

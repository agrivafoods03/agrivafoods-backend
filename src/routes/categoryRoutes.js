import { Router } from 'express';
import {
  getCategories,
  getPublicCategories,
  createCategory,
  updateCategory,
  deleteCategory
} from '../controllers/categoryController.js';
import { authenticate, authorize } from '../middlewares/authMiddleware.js';
import { validateBody } from '../middlewares/validateMiddleware.js';

const router = Router();

// Public categories
router.get('/', getPublicCategories);
router.get('/all', getCategories);

// Admin Category management
router.post('/', authenticate, authorize('admin'), validateBody(['name']), createCategory);
router.put('/:id', authenticate, authorize('admin'), updateCategory);
router.delete('/:id', authenticate, authorize('admin'), deleteCategory);

export default router;

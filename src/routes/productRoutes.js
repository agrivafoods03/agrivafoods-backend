import { Router } from 'express';
import {
  getProducts,
  getProductBySlug,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getCategories
} from '../controllers/productController.js';
import { authenticate, authorize } from '../middlewares/authMiddleware.js';
import { validateBody } from '../middlewares/validateMiddleware.js';

const router = Router();

// Public catalog routes
router.get('/', getProducts);
router.get('/categories', getCategories);
router.get('/slug/:slug', getProductBySlug);
router.get('/:id', getProductById);

// Admin product management
router.post('/', authenticate, authorize('admin'), validateBody(['name', 'slug', 'category']), createProduct);
router.put('/:id', authenticate, authorize('admin'), updateProduct);
router.delete('/:id', authenticate, authorize('admin'), deleteProduct);

export default router;

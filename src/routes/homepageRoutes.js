import { Router } from 'express';
import { getHomepageConfig, updateHomepageConfig } from '../controllers/homepageController.js';
import { authenticate, authorize } from '../middlewares/authMiddleware.js';

const router = Router();

// Public homepage settings
router.get('/', getHomepageConfig);

// Admin update homepage settings
router.put('/', authenticate, authorize('admin'), updateHomepageConfig);

export default router;

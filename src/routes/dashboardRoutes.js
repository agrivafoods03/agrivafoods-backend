import { Router } from 'express';
import { getStats } from '../controllers/dashboardController.js';
import { authenticate, authorize } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/stats', authenticate, authorize('admin'), getStats);

export default router;

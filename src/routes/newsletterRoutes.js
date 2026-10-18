import { Router } from 'express';
import { subscribe, unsubscribe, getSubscribers } from '../controllers/newsletterController.js';
import { authenticate, authorize } from '../middlewares/authMiddleware.js';
import { validateBody, validateEmail } from '../middlewares/validateMiddleware.js';

const router = Router();

router.post('/subscribe', validateBody(['email']), validateEmail('email'), subscribe);
router.post('/unsubscribe', validateBody(['email']), validateEmail('email'), unsubscribe);
router.get('/', authenticate, authorize('admin'), getSubscribers);

export default router;

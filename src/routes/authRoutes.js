import { Router } from 'express';
import { register, login, getMe, changePassword, logout } from '../controllers/authController.js';
import { authenticate } from '../middlewares/authMiddleware.js';
import { validateBody, validateEmail } from '../middlewares/validateMiddleware.js';
import { authLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

router.post('/register', authLimiter, validateBody(['name', 'email', 'password']), validateEmail('email'), register);
router.post('/login', authLimiter, validateBody(['email', 'password']), validateEmail('email'), login);
router.get('/me', authenticate, getMe);
router.post('/change-password', authenticate, validateBody(['currentPassword', 'newPassword']), changePassword);
router.post('/logout', authenticate, logout);

export default router;

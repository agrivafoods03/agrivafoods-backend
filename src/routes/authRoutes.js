import { Router } from 'express';
import { register, login, getMe, changePassword, logout, forgotPassword, verifyResetOtp, resetPassword } from '../controllers/authController.js';
import { authenticate } from '../middlewares/authMiddleware.js';
import { validateBody, validateEmail } from '../middlewares/validateMiddleware.js';
import { authLimiter, otpLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

router.post('/register', authLimiter, validateBody(['name', 'email', 'password']), validateEmail('email'), register);
router.post('/login', authLimiter, validateBody(['email', 'password']), validateEmail('email'), login);
router.get('/me', authenticate, getMe);
router.post('/change-password', authenticate, validateBody(['currentPassword', 'newPassword']), changePassword);
router.post('/logout', authenticate, logout);

// Password Reset Endpoints
router.post('/forgot-password', otpLimiter, validateBody(['email']), validateEmail('email'), forgotPassword);
router.post('/verify-otp', otpLimiter, validateBody(['email', 'otp']), verifyResetOtp);
router.post('/reset-password', otpLimiter, validateBody(['email', 'resetToken', 'newPassword', 'confirmPassword']), resetPassword);

export default router;

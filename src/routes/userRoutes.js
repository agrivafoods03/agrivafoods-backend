import { Router } from 'express';
import {
  getProfile,
  updateProfile,
  addAddress,
  deleteAddress,
  getWishlist,
  toggleWishlist,
  getAllUsers
} from '../controllers/userController.js';
import { authenticate, authorize } from '../middlewares/authMiddleware.js';
import { validateBody } from '../middlewares/validateMiddleware.js';

const router = Router();

// Profile operations (Authenticated)
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);

// Address Book operations
router.post('/addresses', authenticate, validateBody(['street', 'city', 'state', 'pincode']), addAddress);
router.delete('/addresses/:addressId', authenticate, deleteAddress);

// Wishlist operations
router.get('/wishlist', authenticate, getWishlist);
router.post('/wishlist/toggle', authenticate, validateBody(['productSlug']), toggleWishlist);

// Admin-only operations
router.get('/', authenticate, authorize('admin'), getAllUsers);

export default router;

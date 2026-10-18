import { Router } from 'express';
import {
  submitContact,
  getAllContacts,
  updateContactStatus,
  deleteContact
} from '../controllers/contactController.js';
import { authenticate, authorize } from '../middlewares/authMiddleware.js';
import { validateBody, validateEmail } from '../middlewares/validateMiddleware.js';

const router = Router();

// Public submission
router.post('/', validateBody(['name', 'email', 'message']), validateEmail('email'), submitContact);

// Admin management
router.get('/', authenticate, authorize('admin'), getAllContacts);
router.put('/:id/status', authenticate, authorize('admin'), updateContactStatus);
router.delete('/:id', authenticate, authorize('admin'), deleteContact);

export default router;

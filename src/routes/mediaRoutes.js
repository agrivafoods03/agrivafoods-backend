import { Router } from 'express';
import { getAllMedia, uploadMedia, deleteMedia, streamMedia } from '../controllers/mediaController.js';
import { upload } from '../middlewares/uploadMiddleware.js';
import { authenticate, authorize } from '../middlewares/authMiddleware.js';

const router = Router();

// Public media streaming route (no auth required for browser <img> tags)
router.get('/file/*', streamMedia);

// Upload single or multiple images
router.post('/upload', authenticate, authorize('admin'), upload.array('images', 10), uploadMedia);
router.post('/upload-single', authenticate, authorize('admin'), upload.single('image'), uploadMedia);

// List all media and delete media
router.get('/', authenticate, authorize('admin'), getAllMedia);
router.delete('/:filename', authenticate, authorize('admin'), deleteMedia);

export default router;

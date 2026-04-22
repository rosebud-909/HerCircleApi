import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as authController from '../controllers/authController.js';

const router = Router();

router.post('/register', requireAuth, authController.register);
router.post('/google', requireAuth, authController.googleAuth);
router.post('/logout', requireAuth, authController.logout);

export default router;

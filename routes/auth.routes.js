import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { authGoogleLimiter, authRegisterLimiter } from '../middleware/rateLimits.js';
import * as authController from '../controllers/authController.js';

const router = Router();

router.post('/register', requireAuth, authRegisterLimiter, authController.register);
router.post('/google', requireAuth, authGoogleLimiter, authController.googleAuth);
router.post('/logout', requireAuth, authController.logout);

export default router;

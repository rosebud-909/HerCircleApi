import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { verificationSubmitLimiter } from '../middleware/rateLimits.js';
import { verificationUpload } from '../middleware/verificationUpload.js';
import * as verificationController from '../controllers/verificationController.js';

const router = Router();

router.post(
  '/submit',
  requireAuth,
  verificationSubmitLimiter,
  verificationUpload,
  verificationController.submitVerification,
);
router.get('/status', requireAuth, verificationController.getVerificationStatus);

export default router;

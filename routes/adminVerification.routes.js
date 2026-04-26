import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import * as adminVerificationController from '../controllers/adminVerificationController.js';

const router = Router();

router.get('/pending', requireAuth, requireAdmin, adminVerificationController.listPending);
router.get('/:userId', requireAuth, requireAdmin, adminVerificationController.getOne);
router.patch('/:userId', requireAuth, requireAdmin, adminVerificationController.decide);

export default router;


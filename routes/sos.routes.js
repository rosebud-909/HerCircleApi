import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as sosController from '../controllers/sosController.js';

const router = Router();

router.post('/', requireAuth, sosController.createSos);
router.get('/active', requireAuth, sosController.listActive);
router.patch('/:id/resolve', requireAuth, sosController.resolveSos);
router.patch('/:id/message', requireAuth, sosController.patchMessage);

export default router;

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as requestController from '../controllers/requestController.js';

const router = Router();

router.get('/', requireAuth, requestController.listFeed);
router.get('/:id', requireAuth, requestController.getById);
router.post('/', requireAuth, requestController.create);
router.patch('/:id/status', requireAuth, requestController.patchStatus);

export default router;

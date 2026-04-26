import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as userController from '../controllers/userController.js';

const router = Router();

router.post('/me', requireAuth, userController.upsertMe);
router.get('/me', requireAuth, userController.getMe);
router.patch('/me', requireAuth, userController.patchMe);
router.delete('/me', requireAuth, userController.deleteMe);
router.get('/me/requests', requireAuth, userController.listMyRequestsHandler);
router.get('/', requireAuth, userController.listUsersPublic);
router.get('/:id', requireAuth, userController.getUserByIdPublic);

export default router;

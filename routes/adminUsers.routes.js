import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import * as adminUsersController from '../controllers/adminUsersController.js';

const router = Router();

router.get('/users', requireAuth, requireAdmin, adminUsersController.listUsersForAdmin);

export default router;

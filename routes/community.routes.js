import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { communityMembersLimiter } from '../middleware/rateLimits.js';
import * as communityController from '../controllers/communityController.js';

const router = Router();

router.get('/members', requireAuth, communityMembersLimiter, communityController.listMembers);

export default router;

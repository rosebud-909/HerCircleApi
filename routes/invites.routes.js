import { Router } from 'express';
import { invitesValidateLimiter } from '../middleware/rateLimits.js';
import * as invitesController from '../controllers/invitesController.js';

const router = Router();

router.get('/validate', invitesValidateLimiter, invitesController.validateInviteQuery);

export default router;

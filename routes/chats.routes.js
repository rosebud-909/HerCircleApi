import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { chatsCreateLimiter, chatsMessageLimiter } from '../middleware/rateLimits.js';
import * as chatController from '../controllers/chatController.js';

const router = Router();

router.post('/', requireAuth, chatsCreateLimiter, chatController.createChat);
router.get('/', requireAuth, chatController.listChats);
router.get('/:chatId/messages', requireAuth, chatController.getMessages);
router.post('/:chatId/messages', requireAuth, chatsMessageLimiter, chatController.postMessage);

export default router;

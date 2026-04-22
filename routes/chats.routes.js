import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as chatController from '../controllers/chatController.js';

const router = Router();

router.post('/', requireAuth, chatController.createChat);
router.get('/', requireAuth, chatController.listChats);
router.get('/:chatId/messages', requireAuth, chatController.getMessages);
router.post('/:chatId/messages', requireAuth, chatController.postMessage);

export default router;

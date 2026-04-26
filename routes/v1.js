import { Router } from 'express';
import authRoutes from './auth.routes.js';
import usersRoutes from './users.routes.js';
import verificationRoutes from './verification.routes.js';
import adminVerificationRoutes from './adminVerification.routes.js';
import requestsRoutes from './requests.routes.js';
import chatsRoutes from './chats.routes.js';
import communityRoutes from './community.routes.js';
import sosRoutes from './sos.routes.js';

const v1 = Router();

v1.use('/auth', authRoutes);
v1.use('/users', usersRoutes);
v1.use('/verification', verificationRoutes);
v1.use('/admin/verification', adminVerificationRoutes);
v1.use('/requests', requestsRoutes);
v1.use('/chats', chatsRoutes);
v1.use('/community', communityRoutes);
v1.use('/sos', sosRoutes);

export default v1;

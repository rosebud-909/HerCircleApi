import { Router } from 'express';
import { postalLocationLimiter } from '../middleware/rateLimits.js';
import * as locationController from '../controllers/locationController.js';

const router = Router();

router.get('/postal', postalLocationLimiter, locationController.getPostalLocation);

export default router;

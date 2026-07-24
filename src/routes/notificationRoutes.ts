import { Router } from 'express';
import { notificationController } from '@controllers/notificationController';
import { requireAuth } from '@middleware/auth';

const router = Router();

router.get('/', requireAuth(), notificationController.list);

export default router;

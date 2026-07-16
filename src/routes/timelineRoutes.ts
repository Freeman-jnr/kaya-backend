import { Router } from 'express';
import { timelineController } from '@controllers/timelineController';
import { requireAuth } from '@middleware/auth';

const router = Router();

router.get('/', requireAuth(), timelineController.list);

export default router;

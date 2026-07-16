import { Router } from 'express';
import { reminderController } from '@controllers/reminderController';
import { requireAuth } from '@middleware/auth';

const router = Router();

router.get('/', requireAuth(), reminderController.list);
router.post('/', requireAuth(), reminderController.create);

export default router;

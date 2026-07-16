import { Router } from 'express';
import { aiController } from '@controllers/aiController';
import { requireAuth } from '@middleware/auth';

const router = Router();

router.post('/conversation', requireAuth(), aiController.conversation);

export default router;

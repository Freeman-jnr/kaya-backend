import { Router } from 'express';
import { businessController } from '@controllers/businessController';
import { requireAuth } from '@middleware/auth';

const router = Router();

router.get('/me', requireAuth(), businessController.getCurrent);
router.put('/me', requireAuth(), businessController.updateCurrent);

export default router;

import { Router } from 'express';
import { dashboardController } from '@controllers/dashboardController';
import { requireAuth } from '@middleware/auth';

const router = Router();

router.get('/summary', requireAuth(), dashboardController.getSummary);

export default router;

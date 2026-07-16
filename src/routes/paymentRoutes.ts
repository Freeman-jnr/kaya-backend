import { Router } from 'express';
import { paymentController } from '@controllers/paymentController';
import { requireAuth } from '@middleware/auth';

const router = Router();

router.get('/', requireAuth(), paymentController.list);
router.post('/', requireAuth(), paymentController.create);
router.patch('/:id', requireAuth(), paymentController.update);

export default router;

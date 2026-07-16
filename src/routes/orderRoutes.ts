import { Router } from 'express';
import { orderController } from '@controllers/orderController';
import { requireAuth } from '@middleware/auth';

const router = Router();

router.get('/', requireAuth(), orderController.list);
router.post('/', requireAuth(), orderController.create);
router.patch('/:id', requireAuth(), orderController.update);
router.delete('/:id', requireAuth(), orderController.remove);

export default router;

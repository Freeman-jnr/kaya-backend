import { Router } from 'express';
import { customerController } from '@controllers/customerController';
import { requireAuth } from '@middleware/auth';

const router = Router();

router.get('/', requireAuth(), customerController.list);
router.get('/:id', requireAuth(), customerController.getById);
router.post('/', requireAuth(), customerController.create);
router.put('/:id', requireAuth(), customerController.update);

export default router;

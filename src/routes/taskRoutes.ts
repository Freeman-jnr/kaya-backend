import { Router } from 'express';
import { taskController } from '@controllers/taskController';
import { requireAuth } from '@middleware/auth';

const router = Router();

router.get('/', requireAuth(), taskController.list);
router.post('/', requireAuth(), taskController.create);
router.patch('/:id', requireAuth(), taskController.update);

export default router;

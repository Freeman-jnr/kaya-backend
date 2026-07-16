import { Router } from 'express';
import { expenseController } from '@controllers/expenseController';
import { requireAuth } from '@middleware/auth';

const router = Router();

router.get('/', requireAuth(), expenseController.list);
router.post('/', requireAuth(), expenseController.create);

export default router;

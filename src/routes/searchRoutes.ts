import { Router } from 'express';
import { searchController } from '@controllers/searchController';
import { requireAuth } from '@middleware/auth';

const router = Router();

router.get('/', requireAuth(), searchController.search);

export default router;

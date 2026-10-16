import { Router } from 'express';
import { listJobSources, createJobSource } from '../controllers/jobSource.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.get('/', requireAuth, listJobSources);
router.post('/', requireAuth, requireRole('placement_officer', 'admin'), createJobSource);

export default router;

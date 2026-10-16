import { Router } from 'express';
import {
  listAlumni,
  getAlumniById,
  createAlumniProfile,
  requestReferral,
} from '../controllers/alumni.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Public/student-visible alumni directory
router.get('/', listAlumni);
router.get('/:id', getAlumniById);

// Authenticated alumni profile creation & referral requests
router.post('/', requireAuth, createAlumniProfile);
router.post('/:id/request-referral', requireAuth, requestReferral);

export default router;

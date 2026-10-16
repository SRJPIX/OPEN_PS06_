import { Router } from 'express';
import {
  getMyApplications,
  getApplicationById,
  submitApplication,
  withdrawApplication,
} from '../controllers/application.controller';
import { requireAuth, requireStudent } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

/**
 * @route   GET /api/applications/me
 * @desc    Get all applications submitted by the current student
 * @access  Private (Student)
 */
router.get('/me', requireStudent, getMyApplications);

/**
 * @route   POST /api/applications
 * @desc    Submit application using approved-resume workflow
 * @access  Private (Student)
 */
router.post('/', requireStudent, submitApplication);

/**
 * @route   GET /api/applications/:id
 * @desc    Get detailed application with chronological status history
 * @access  Private
 */
router.get('/:id', getApplicationById);

/**
 * @route   PATCH /api/applications/:id/withdraw
 * @desc    Withdraw an active application
 * @access  Private (Student)
 */
router.patch('/:id/withdraw', requireStudent, withdrawApplication);

export default router;


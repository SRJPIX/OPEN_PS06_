import { Router } from 'express';
import {
  getMyApplications,
  getApplicationById,
  submitApplication,
  withdrawApplication,
  listApplications,
  updateApplicationStatus,
  updateInterviewDetails,
  updateOfferDetails,
  exportApplicationsCsv,
  getStudentApplicationStats,
  getPlacementApplicationStats,
} from '../controllers/application.controller';
import {
  requireAuth,
  requireStudent,
  requireRole,
} from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

/**
 * @route   GET /api/applications/me
 * @desc    Get all applications submitted by the current student
 * @access  Private (Student)
 */
router.get('/me', requireStudent, getMyApplications);

/**
 * @route   GET /api/applications/stats/student
 * @desc    Get student application pipeline dashboard statistics
 * @access  Private (Student)
 */
router.get('/stats/student', requireStudent, getStudentApplicationStats);

/**
 * @route   GET /api/applications/stats/placement
 * @desc    Get aggregate placement pipeline statistics
 * @access  Private (Placement Officer, Admin, Recruiter)
 */
router.get(
  '/stats/placement',
  requireRole('placement_officer', 'admin', 'recruiter'),
  getPlacementApplicationStats
);

/**
 * @route   GET /api/applications/export/csv
 * @desc    Export applications to RFC 4180 CSV
 * @access  Private (Placement Officer, Admin, Recruiter)
 */
router.get(
  '/export/csv',
  requireRole('placement_officer', 'admin', 'recruiter'),
  exportApplicationsCsv
);

/**
 * @route   POST /api/applications
 * @desc    Submit application using approved-resume workflow
 * @access  Private (Student)
 */
router.post('/', requireStudent, submitApplication);

/**
 * @route   GET /api/applications
 * @desc    List applications with filtering, search, and pagination
 * @access  Private (Placement Officer, Admin, Recruiter)
 */
router.get(
  '/',
  requireRole('placement_officer', 'admin', 'recruiter'),
  listApplications
);

/**
 * @route   GET /api/applications/:id
 * @desc    Get detailed application with chronological status history
 * @access  Private
 */
router.get('/:id', getApplicationById);

/**
 * @route   PATCH /api/applications/:id/status
 * @desc    Move application through valid workflow transitions
 * @access  Private (Placement Officer, Admin, Recruiter, Student)
 */
router.patch(
  '/:id/status',
  requireRole('placement_officer', 'admin', 'recruiter', 'student'),
  updateApplicationStatus
);

/**
 * @route   PATCH /api/applications/:id/interview
 * @desc    Update or schedule interview details
 * @access  Private (Placement Officer, Admin, Recruiter)
 */
router.patch(
  '/:id/interview',
  requireRole('placement_officer', 'admin', 'recruiter'),
  updateInterviewDetails
);

/**
 * @route   PATCH /api/applications/:id/offer
 * @desc    Record or update job offer details
 * @access  Private (Placement Officer, Admin, Recruiter)
 */
router.patch(
  '/:id/offer',
  requireRole('placement_officer', 'admin', 'recruiter'),
  updateOfferDetails
);

/**
 * @route   PATCH /api/applications/:id/withdraw
 * @desc    Withdraw an active application
 * @access  Private (Student)
 */
router.patch('/:id/withdraw', requireStudent, withdrawApplication);

export default router;

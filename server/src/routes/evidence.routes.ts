import { Router } from 'express';
import {
  submitEvidence,
  getMyEvidence,
  getEvidenceById,
  listPendingEvaluations,
  reviewEvidence,
} from '../controllers/evidence.controller';
import {
  requireAuth,
  requireStudent,
  requirePlacementOfficer,
} from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { submitEvidenceSchema, reviewEvidenceSchema } from '../validators/student.validator';

const router = Router();

// All evidence routes require authenticated user
router.use(requireAuth);

/**
 * @route   GET /api/evidence/reviews/pending
 * @desc    Placement officer: list all evidence pending review
 * @access  Private (Placement Officer / Admin)
 */
router.get('/reviews/pending', requirePlacementOfficer, listPendingEvaluations);

/**
 * @route   POST /api/evidence/:id/review
 * @desc    Placement officer: approve, reject, or request changes on evidence
 * @access  Private (Placement Officer / Admin)
 */
router.post(
  '/:id/review',
  requirePlacementOfficer,
  validateBody(reviewEvidenceSchema),
  reviewEvidence
);

/**
 * @route   POST /api/evidence
 * @desc    Student: submit evidence backing one or more skills
 * @access  Private (Student)
 */
router.post('/', requireStudent, validateBody(submitEvidenceSchema), submitEvidence);

/**
 * @route   GET /api/evidence
 * @desc    Student: list own submitted evidence
 * @access  Private (Student)
 */
router.get('/', requireStudent, getMyEvidence);

/**
 * @route   GET /api/evidence/:id
 * @desc    Get detailed evidence item (Ownership checked for students)
 * @access  Private (Student owner, Placement Officer, Admin)
 */
router.get('/:id', getEvidenceById);

export default router;

import { Router } from 'express';
import {
  getMyResumes,
  getResumeById,
  generateResume,
  analyzeUploadedResume,
  deleteResume,
  listResumeClaims,
  verifyResumeClaim,
} from '../controllers/resume.controller';
import { requireAuth, requireStudent, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

/**
 * @route   GET /api/resumes/claims
 * @desc    Placement officer: list resume claims for verification review
 * @access  Private (Placement Officer, Admin)
 */
router.get('/claims', requireRole('placement_officer', 'admin'), listResumeClaims);

/**
 * @route   POST /api/resumes/claims/:id/verify
 * @desc    Placement officer: verify or unverify a resume claim
 * @access  Private (Placement Officer, Admin)
 */
router.post('/claims/:id/verify', requireRole('placement_officer', 'admin'), verifyResumeClaim);

/**
 * @route   GET /api/resumes/me
 * @desc    Get all resumes created by the authenticated student
 * @access  Private (Student)
 */
router.get('/me', requireStudent, getMyResumes);

/**
 * @route   POST /api/resumes/generate
 * @desc    Generate a tailored resume backed by verified skills & evidence
 * @access  Private (Student)
 */
router.post('/generate', requireStudent, generateResume);

/**
 * @route   POST /api/resumes/analyze-upload
 * @desc    Upload & analyze resume text/claims against verified evidence
 * @access  Private (Student)
 */
router.post('/analyze-upload', requireStudent, analyzeUploadedResume);

/**
 * @route   GET /api/resumes/:id
 * @desc    Get resume details along with associated factual claims
 * @access  Private
 */
router.get('/:id', getResumeById);

/**
 * @route   DELETE /api/resumes/:id
 * @desc    Delete a resume and its claims
 * @access  Private (Student)
 */
router.delete('/:id', requireStudent, deleteResume);

export default router;


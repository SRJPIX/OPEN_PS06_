import { Router } from 'express';
import {
  getMyCompanyProfile,
  updateCompanyProfile,
  getRecruiterJobs,
  getRecruiterJobCandidates,
  getCandidateEvidenceForRecruiter,
} from '../controllers/recruiter.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

// All recruiter routes require authenticated recruiter or admin
router.use(requireAuth);
router.use(requireRole('recruiter', 'admin'));

/**
 * @route   GET /api/recruiter/company
 * @desc    Get recruiter's company profile
 */
router.get('/company', getMyCompanyProfile);

/**
 * @route   PUT /api/recruiter/company
 * @desc    Update company profile details (website, industry, description, logoUrl)
 */
router.put('/company', updateCompanyProfile);

/**
 * @route   GET /api/recruiter/jobs
 * @desc    Get all requisitions for recruiter's company with application counts
 */
router.get('/jobs', getRecruiterJobs);

/**
 * @route   GET /api/recruiter/jobs/:jobId/candidates
 * @desc    Get ranked applicant shortlist with candidate fit scores and skill gaps
 */
router.get('/jobs/:jobId/candidates', getRecruiterJobCandidates);

/**
 * @route   GET /api/recruiter/candidates/:studentId/evidence
 * @desc    Inspect verified evidence deliverables for applied candidate
 */
router.get('/candidates/:studentId/evidence', getCandidateEvidenceForRecruiter);

export default router;


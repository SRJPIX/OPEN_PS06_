import { Router } from 'express';
import {
  getJobCandidateRankings,
  exportJobRankingsCsv,
  getSingleCandidateMatch,
  getMyJobFit,
} from '../controllers/matching.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

// 1. Student self-inspection of job fit
router.get('/jobs/:jobId/my-fit', requireAuth, requireRole('student'), getMyJobFit);

// 2. Placement Officer & Recruiter Batch Ranking
router.get(
  '/jobs/:jobId/rank',
  requireAuth,
  requireRole('placement_officer', 'recruiter', 'admin'),
  getJobCandidateRankings
);

// 3. Placement Officer & Recruiter CSV Export
router.get(
  '/jobs/:jobId/export/csv',
  requireAuth,
  requireRole('placement_officer', 'recruiter', 'admin'),
  exportJobRankingsCsv
);

// 4. Detailed Candidate Match Inspection
router.get(
  '/jobs/:jobId/students/:studentId',
  requireAuth,
  requireRole('placement_officer', 'recruiter', 'admin'),
  getSingleCandidateMatch
);

export default router;

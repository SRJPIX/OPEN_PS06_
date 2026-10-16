import { Router } from 'express';
import {
  createJob,
  getJobs,
  getJobById,
  updateJob,
  archiveJob,
  parseJobDescriptionEndpoint,
  importJobsCsvEndpoint,
  getJobDuplicatesEndpoint,
  getAllDuplicateCandidatesEndpoint,
  mergeJobsEndpoint,
} from '../controllers/job.controller';
import { requireAuth, optionalAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

// 1. Public & Student-filtered job browsing
router.get('/', optionalAuth, getJobs);

// 4. Job Duplicate Review & Merge (placed before /:id)
router.get(
  '/duplicates/all',
  requireAuth,
  requireRole('placement_officer', 'recruiter', 'admin'),
  getAllDuplicateCandidatesEndpoint
);

router.get(
  '/:id/duplicates',
  requireAuth,
  requireRole('placement_officer', 'recruiter', 'admin'),
  getJobDuplicatesEndpoint
);

// 2. Job Parsing (deterministic + optional LLM)
router.post(
  '/parse',
  requireAuth,
  requireRole('placement_officer', 'recruiter', 'admin'),
  parseJobDescriptionEndpoint
);

// 3. CSV Job Ingestion
router.post(
  '/import/csv',
  requireAuth,
  requireRole('placement_officer', 'recruiter', 'admin'),
  importJobsCsvEndpoint
);

router.get('/:id', optionalAuth, getJobById);

router.post(
  '/merge',
  requireAuth,
  requireRole('placement_officer', 'recruiter', 'admin'),
  mergeJobsEndpoint
);

// 5. Job Creation, Update & Archive
router.post('/', requireAuth, requireRole('placement_officer', 'recruiter', 'admin'), createJob);

router.put('/:id', requireAuth, requireRole('placement_officer', 'recruiter', 'admin'), updateJob);

router.patch(
  '/:id/archive',
  requireAuth,
  requireRole('placement_officer', 'recruiter', 'admin'),
  archiveJob
);

export default router;

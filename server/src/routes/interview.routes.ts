import { Router } from 'express';
import {
  getInterviewReports,
  getQuestionBank,
  submitInterviewReport,
  listPendingReports,
  moderateReport,
} from '../controllers/interview.controller';
import { requireAuth, optionalAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

// Browsing experiences and question bank (accessible to all, optionalAuth parses user for audit/privacy)
router.get('/experiences', optionalAuth, getInterviewReports);
router.get('/questions', getQuestionBank);

// Submission by authenticated student
router.post('/experiences', requireAuth, submitInterviewReport);

// Moderation workflows for placement officers
router.get('/moderation', requireAuth, requireRole('placement_officer', 'admin'), listPendingReports);
router.patch('/experiences/:id/moderate', requireAuth, requireRole('placement_officer', 'admin'), moderateReport);

export default router;

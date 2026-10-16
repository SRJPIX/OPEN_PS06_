import { Router } from 'express';
import {
  getMyProfile,
  updateMyProfile,
  addOrUpdateSkill,
  getDashboardStats,
  getStudentAssessments,
  createStudentAssessment,
  getStudentProjects,
  createStudentProject,
} from '../controllers/student.controller';
import { requireAuth, requireStudent } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate.middleware';
import {
  updateProfileSchema,
  addSkillSchema,
  createAssessmentSchema,
  createProjectSchema,
} from '../validators/student.validator';

const router = Router();

// All student routes require authenticated student
router.use(requireAuth, requireStudent);

/**
 * @route   GET /api/students/dashboard/stats
 * @desc    Get real database-backed statistics for student dashboard
 * @access  Private (Student)
 */
router.get('/dashboard/stats', getDashboardStats);

/**
 * @route   GET /api/students/profile/me
 * @desc    Get current student's profile, skills, and metrics
 * @access  Private (Student)
 */
router.get('/profile/me', getMyProfile);

/**
 * @route   PUT /api/students/profile/me
 * @desc    Update current student's academic and personal profile
 * @access  Private (Student)
 */
router.put('/profile/me', validateBody(updateProfileSchema), updateMyProfile);

/**
 * @route   POST /api/students/skills
 * @desc    Add or update a self-reported skill
 * @access  Private (Student)
 */
router.post('/skills', validateBody(addSkillSchema), addOrUpdateSkill);

/**
 * @route   GET /api/students/assessments
 * @desc    Get all proctored/verified assessments for student
 * @access  Private (Student)
 */
router.get('/assessments', getStudentAssessments);

/**
 * @route   POST /api/students/assessments
 * @desc    Submit assessment and auto-generate linked evidence
 * @access  Private (Student)
 */
router.post('/assessments', validateBody(createAssessmentSchema), createStudentAssessment);

/**
 * @route   GET /api/students/projects
 * @desc    Get all evaluated projects for student
 * @access  Private (Student)
 */
router.get('/projects', getStudentProjects);

/**
 * @route   POST /api/students/projects
 * @desc    Submit evaluated project and auto-generate linked evidence
 * @access  Private (Student)
 */
router.post('/projects', validateBody(createProjectSchema), createStudentProject);

export default router;


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
import { listStudents, getStudentDetailsById } from '../controllers/student.controller';
import { requireRole } from '../middleware/auth.middleware';

const router = Router();

// All student routes require authenticated user
router.use(requireAuth);

/**
 * @route   GET /api/students
 * @desc    Placement officer & recruiter: list students with filters & pagination
 * @access  Private (Placement Officer, Recruiter, Admin)
 */
router.get('/', requireRole('placement_officer', 'recruiter', 'admin'), listStudents);

/**
 * @route   GET /api/students/:id
 * @desc    Placement officer & recruiter: detailed student profile with evidence and skills
 * @access  Private (Placement Officer, Recruiter, Admin)
 */
router.get('/:id', requireRole('placement_officer', 'recruiter', 'admin'), getStudentDetailsById);

/**
 * @route   GET /api/students/dashboard/stats
 * @desc    Get real database-backed statistics for student dashboard
 * @access  Private (Student)
 */
router.get('/dashboard/stats', requireStudent, getDashboardStats);

/**
 * @route   GET /api/students/profile/me
 * @desc    Get current student's profile, skills, and metrics
 * @access  Private (Student)
 */
router.get('/profile/me', requireStudent, getMyProfile);

/**
 * @route   PUT /api/students/profile/me
 * @desc    Update current student's academic and personal profile
 * @access  Private (Student)
 */
router.put('/profile/me', requireStudent, validateBody(updateProfileSchema), updateMyProfile);

/**
 * @route   POST /api/students/skills
 * @desc    Add or update a self-reported skill
 * @access  Private (Student)
 */
router.post('/skills', requireStudent, validateBody(addSkillSchema), addOrUpdateSkill);

/**
 * @route   GET /api/students/assessments
 * @desc    Get all proctored/verified assessments for student
 * @access  Private (Student)
 */
router.get('/assessments', requireStudent, getStudentAssessments);

/**
 * @route   POST /api/students/assessments
 * @desc    Submit assessment and auto-generate linked evidence
 * @access  Private (Student)
 */
router.post('/assessments', requireStudent, validateBody(createAssessmentSchema), createStudentAssessment);

/**
 * @route   GET /api/students/projects
 * @desc    Get all evaluated projects for student
 * @access  Private (Student)
 */
router.get('/projects', requireStudent, getStudentProjects);

/**
 * @route   POST /api/students/projects
 * @desc    Submit evaluated project and auto-generate linked evidence
 * @access  Private (Student)
 */
router.post('/projects', requireStudent, validateBody(createProjectSchema), createStudentProject);

export default router;


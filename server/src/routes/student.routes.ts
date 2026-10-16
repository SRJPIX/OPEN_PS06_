import { Router } from 'express';
import { getMyProfile, updateMyProfile, addOrUpdateSkill } from '../controllers/student.controller';
import { requireAuth, requireStudent } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { updateProfileSchema, addSkillSchema } from '../validators/student.validator';

const router = Router();

// All student routes require authenticated student
router.use(requireAuth, requireStudent);

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

export default router;

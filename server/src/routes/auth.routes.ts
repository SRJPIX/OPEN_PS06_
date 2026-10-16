import { Router, Request, Response } from 'express';
import { registerStudent, login, logout, getMe } from '../controllers/auth.controller';
import { validateBody } from '../middleware/validate.middleware';
import { registerStudentSchema, loginSchema } from '../validators/auth.validator';
import {
  requireAuth,
  requireStudent,
  requirePlacementOfficer,
  requireRecruiter,
} from '../middleware/auth.middleware';
import { authRateLimiter } from '../middleware/rateLimiter';
import { sendSuccess } from '../utils/apiResponse';

const router = Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new student account
 * @access  Public
 */
router.post('/register', authRateLimiter, validateBody(registerStudentSchema), registerStudent);

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and set HTTP-only cookie
 * @access  Public
 */
router.post('/login', authRateLimiter, validateBody(loginSchema), login);

/**
 * @route   POST /api/auth/logout
 * @desc    Clear session cookie
 * @access  Public
 */
router.post('/logout', logout);

/**
 * @route   GET /api/auth/me
 * @desc    Session restoration: fetch current authenticated user profile
 * @access  Private
 */
router.get('/me', requireAuth, getMe);

/**
 * Verification & role-guard demonstration endpoints
 */
router.get('/role-check/student', requireAuth, requireStudent, (req: Request, res: Response) => {
  sendSuccess(res, { role: req.user?.role, access: 'granted' }, 'Student access confirmed');
});

router.get(
  '/role-check/placement-officer',
  requireAuth,
  requirePlacementOfficer,
  (req: Request, res: Response) => {
    sendSuccess(
      res,
      { role: req.user?.role, access: 'granted' },
      'Placement Officer access confirmed'
    );
  }
);

router.get(
  '/role-check/recruiter',
  requireAuth,
  requireRecruiter,
  (req: Request, res: Response) => {
    sendSuccess(res, { role: req.user?.role, access: 'granted' }, 'Recruiter access confirmed');
  }
);

export default router;

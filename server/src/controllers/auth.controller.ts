import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';
import { getAuthCookieOptions, getClearCookieOptions } from '../config/cookie';
import { User } from '../models/User';
import { StudentProfile } from '../models/StudentProfile';
import { AuditLog } from '../models/AuditLog';
import { hashPassword, comparePassword } from '../utils/password';
import { signAuthToken } from '../utils/token';
import { ApiError } from '../utils/apiError';
import { sendSuccess } from '../utils/apiResponse';
import { RegisterStudentInput, LoginInput } from '../validators/auth.validator';

/**
 * Register a new student user and initialize student profile.
 * Public registration strictly forces role to 'student' to prevent privilege escalation.
 */
export const registerStudent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password, rollNumber, department, degree, graduationYear, cgpa, phone, bio } =
      req.body as RegisterStudentInput;

    // 1. Check for duplicate email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw ApiError.conflict('An account with this email address already exists.');
    }

    // 2. Check for duplicate roll number
    const existingProfile = await StudentProfile.findOne({
      rollNumber: rollNumber.toUpperCase(),
    });
    if (existingProfile) {
      throw ApiError.conflict('A student profile with this roll number already exists.');
    }

    // 3. Hash password with bcrypt
    const passwordHash = await hashPassword(password);

    // 4. Create User - role is strictly set to 'student' (ignoring any client payload)
    const user = await User.create({
      email,
      passwordHash,
      role: 'student',
      status: 'active',
      isEmailVerified: false,
    });

    // 5. Create StudentProfile
    const profile = await StudentProfile.create({
      user: user._id,
      rollNumber,
      department,
      degree: degree || 'B.Tech',
      graduationYear,
      cgpa: cgpa || 0,
      phone,
      bio,
      links: {},
    });

    // 6. Sign JWT
    const token = signAuthToken({
      userId: user._id.toString(),
      role: user.role,
    });

    // 7. Set HTTP-only Cookie
    res.cookie(config.COOKIE_NAME, token, getAuthCookieOptions());

    // 8. Audit log (non-blocking)
    AuditLog.create({
      user: user._id,
      action: 'USER_REGISTER',
      entityType: 'User',
      entityId: user._id.toString(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch((err) => console.error('[AuditLog] Failed to log registration:', err));

    sendSuccess(
      res,
      {
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          status: user.status,
          isEmailVerified: user.isEmailVerified,
          createdAt: user.createdAt,
        },
        profile: {
          id: profile._id,
          rollNumber: profile.rollNumber,
          department: profile.department,
          degree: profile.degree,
          graduationYear: profile.graduationYear,
          cgpa: profile.cgpa,
        },
      },
      'Registration successful',
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Authenticate existing user and set secure HTTP-only cookie.
 */
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body as LoginInput;

    // 1. Find user and explicitly select passwordHash
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) {
      // Generic error message prevents user enumeration attacks
      throw ApiError.unauthorized('Invalid email or password.');
    }

    // 2. Check account suspension
    if (user.status === 'suspended') {
      throw ApiError.forbidden('Your account has been suspended. Please contact administration.');
    }

    // 3. Verify password
    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      throw ApiError.unauthorized('Invalid email or password.');
    }

    // 4. Update last login timestamp
    user.lastLoginAt = new Date();
    await user.save();

    // 5. Sign JWT token
    const token = signAuthToken({
      userId: user._id.toString(),
      role: user.role,
    });

    // 6. Set HTTP-only cookie
    res.cookie(config.COOKIE_NAME, token, getAuthCookieOptions());

    // 7. Audit log
    AuditLog.create({
      user: user._id,
      action: 'USER_LOGIN',
      entityType: 'User',
      entityId: user._id.toString(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch((err) => console.error('[AuditLog] Failed to log login:', err));

    sendSuccess(
      res,
      {
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          status: user.status,
          isEmailVerified: user.isEmailVerified,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
        },
      },
      'Login successful',
      200
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Clear authentication session and HTTP-only cookie.
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
  if (req.user) {
    AuditLog.create({
      user: req.user.userId,
      action: 'USER_LOGOUT',
      entityType: 'User',
      entityId: req.user.userId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch((err) => console.error('[AuditLog] Failed to log logout:', err));
  }

  res.clearCookie(config.COOKIE_NAME, getClearCookieOptions());
  sendSuccess(res, null, 'Logged out successfully', 200);
};

/**
 * Session restoration endpoint: returns current authenticated user and linked profile.
 */
export const getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required.');
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      throw ApiError.unauthorized('User not found.');
    }

    let profile = null;
    if (user.role === 'student') {
      profile = await StudentProfile.findOne({ user: user._id });
    }

    sendSuccess(
      res,
      {
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          status: user.status,
          isEmailVerified: user.isEmailVerified,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
        },
        profile: profile
          ? {
              id: profile._id,
              rollNumber: profile.rollNumber,
              department: profile.department,
              degree: profile.degree,
              graduationYear: profile.graduationYear,
              cgpa: profile.cgpa,
              phone: profile.phone,
              bio: profile.bio,
              links: profile.links,
            }
          : undefined,
      },
      'Current user profile',
      200
    );
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/auth/password
 * Update password with current password verification.
 */
export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized('Authentication required.');

    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!currentPassword || !newPassword) {
      throw ApiError.badRequest('Both current password and new password are required.');
    }

    if (newPassword.length < 8) {
      throw ApiError.badRequest('New password must be at least 8 characters long.');
    }

    const user = await User.findById(req.user.userId).select('+passwordHash');
    if (!user) throw ApiError.unauthorized('User not found.');

    const isValid = await comparePassword(currentPassword, user.passwordHash);
    if (!isValid) {
      throw ApiError.unauthorized('Current password is incorrect.');
    }

    user.passwordHash = await hashPassword(newPassword);
    await user.save();

    AuditLog.create({
      user: user._id,
      action: 'PASSWORD_CHANGED',
      entityType: 'User',
      entityId: user._id.toString(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch((err) => console.error('[AuditLog] Failed to log password change:', err));

    sendSuccess(res, null, 'Password updated successfully');
  } catch (error) {
    next(error);
  }
};


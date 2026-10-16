import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';
import { User, UserRole, UserStatus } from '../models/User';
import { verifyAuthToken } from '../utils/token';
import { ApiError } from '../utils/apiError';

export interface AuthUser {
  userId: string;
  email: string;
  role: UserRole;
  status: UserStatus;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Extracts authentication token from HTTP-only cookie (primary) or Authorization header (fallback).
 */
export const extractToken = (req: Request): string | null => {
  if (req.cookies && req.cookies[config.COOKIE_NAME]) {
    return req.cookies[config.COOKIE_NAME];
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
};

/**
 * Middleware that authenticates a request using the HTTP-only JWT cookie.
 * Attaches authenticated user details to req.user.
 */
export const requireAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);

    if (!token) {
      throw ApiError.unauthorized('Authentication required. No active session found.');
    }

    const payload = verifyAuthToken(token);

    // Verify user exists and account is not suspended
    const user = await User.findById(payload.userId);
    if (!user) {
      throw ApiError.unauthorized('The account associated with this session no longer exists.');
    }

    if (user.status === 'suspended') {
      throw ApiError.forbidden('Your account has been suspended. Please contact administrator.');
    }

    req.user = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      status: user.status,
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Role-based authorization middleware.
 * Guarantees the authenticated user possesses one of the allowed roles.
 */
export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(ApiError.unauthorized('Authentication required.'));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(
        ApiError.forbidden(
          `Access denied. Requires one of the following roles: [${allowedRoles.join(', ')}].`
        )
      );
      return;
    }

    next();
  };
};

export const requireStudent = requireRole('student');
export const requireRecruiter = requireRole('recruiter');
export const requirePlacementOfficer = requireRole('placement_officer');
export const requireAdmin = requireRole('admin');

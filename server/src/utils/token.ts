import jwt, { JwtPayload } from 'jsonwebtoken';
import { config } from '../config/env';
import { UserRole } from '../models/User';
import { ApiError } from './apiError';

export interface AuthTokenPayload extends JwtPayload {
  userId: string;
  role: UserRole;
}

/**
 * Signs a JWT authentication token containing user id and role.
 */
export const signAuthToken = (payload: { userId: string; role: UserRole }): string => {
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
};

/**
 * Verifies and decodes a JWT authentication token.
 * Throws an ApiError 401 if invalid or expired.
 */
export const verifyAuthToken = (token: string): AuthTokenPayload => {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as AuthTokenPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw ApiError.unauthorized('Authentication token has expired. Please log in again.');
    }
    throw ApiError.unauthorized('Invalid authentication token.');
  }
};

import { Request, Response, NextFunction } from 'express';
import { isDatabaseConnected } from '../config/db';
import { ApiError } from '../utils/apiError';

/**
 * Middleware that verifies that an active MongoDB connection exists before executing
 * database-dependent controllers. Prevents Mongoose buffering timeouts from hanging
 * requests and turning into HTTP 500 errors.
 */
export const requireDatabase = (
  _req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (!isDatabaseConnected()) {
    return next(
      ApiError.serviceUnavailable(
        'Database service is currently unavailable. Please ensure MongoDB is running.'
      )
    );
  }
  next();
};


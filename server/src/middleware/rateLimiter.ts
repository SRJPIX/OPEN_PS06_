import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { sendError } from '../utils/apiResponse';

export const createRateLimiter = (options?: {
  windowMs?: number;
  max?: number;
  message?: string;
}) => {
  const isTest = process.env.NODE_ENV === 'test';

  return rateLimit({
    windowMs: options?.windowMs || 15 * 60 * 1000, // 15 minutes
    max: isTest ? 10000 : options?.max || 100, // Max requests per window
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (_req: Request, res: Response) => {
      sendError(
        res,
        'RATE_LIMIT_EXCEEDED',
        options?.message || 'Too many requests from this IP, please try again after 15 minutes.',
        429
      );
    },
    skip: () => isTest,
  });
};

export const apiRateLimiter = createRateLimiter();

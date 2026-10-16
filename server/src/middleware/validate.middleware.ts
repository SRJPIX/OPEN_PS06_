import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

/**
 * Express middleware that validates req.body against a Zod schema.
 * Replaces req.body with the coerced/parsed data on success, or forwards ZodError on failure.
 */
export const validateBody = (schema: ZodSchema) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync(req.body);
      req.body = parsed;
      next();
    } catch (error) {
      next(error);
    }
  };
};

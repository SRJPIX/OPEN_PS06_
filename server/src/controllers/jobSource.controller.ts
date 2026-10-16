import { Request, Response, NextFunction } from 'express';
import { JobSource } from '../models/JobSource';
import { createJobSourceSchema } from '../validators/job.validator';
import { sendSuccess, sendError } from '../utils/apiResponse';

/**
 * GET /api/jobs/sources
 * Lists all active job sources.
 */
export const listJobSources = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sources = await JobSource.find({ isActive: true }).sort({ name: 1 });
    sendSuccess(res, { sources }, 'Job sources retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/jobs/sources
 * Creates a new job source record (Placement Officer / Admin only).
 */
export const createJobSource = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validation = createJobSourceSchema.safeParse(req.body);
    if (!validation.success) {
      sendError(
        res,
        'VALIDATION_ERROR',
        'Validation failed',
        400,
        validation.error.flatten().fieldErrors
      );
      return;
    }

    const source = await JobSource.create(validation.data);
    sendSuccess(res, { source }, 'Job source created successfully', 201);
  } catch (error) {
    next(error);
  }
};

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { ApiError } from '../utils/apiError';
import { sendError } from '../utils/apiResponse';

export const errorHandler = (
  err: Error | ApiError | ZodError | mongoose.Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const includeStack = process.env.NODE_ENV === 'development';

  // 1. Handled Operational ApiError
  if (err instanceof ApiError) {
    sendError(
      res,
      err.code,
      err.message,
      err.statusCode,
      err.details,
      includeStack ? err.stack : undefined
    );
    return;
  }

  // 2. Zod Validation Error
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }));
    sendError(
      res,
      'VALIDATION_ERROR',
      'The request payload contains validation errors',
      422,
      details,
      includeStack ? err.stack : undefined
    );
    return;
  }

  // 3. Mongoose Validation Error
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((item) => ({
      field: item.path,
      message: item.message,
      kind: item.kind,
    }));
    sendError(
      res,
      'DATABASE_VALIDATION_ERROR',
      'Database document validation failed',
      422,
      details,
      includeStack ? err.stack : undefined
    );
    return;
  }

  // 4. Mongoose Cast Error (e.g., invalid ObjectId)
  if (err instanceof mongoose.Error.CastError) {
    sendError(
      res,
      'INVALID_IDENTIFIER',
      `Invalid format for identifier field '${err.path}'`,
      400,
      { value: err.value, expectedType: err.kind },
      includeStack ? err.stack : undefined
    );
    return;
  }

  // 5. MongoDB Duplicate Key Error (Code 11000)
  if ('code' in err && (err as { code: unknown }).code === 11000) {
    const mongoErr = err as { keyValue?: Record<string, unknown> };
    const field = mongoErr.keyValue ? Object.keys(mongoErr.keyValue)[0] : 'resource';
    sendError(
      res,
      'DUPLICATE_RESOURCE',
      `A resource with this ${field} already exists`,
      409,
      mongoErr.keyValue,
      includeStack ? (err as Error).stack : undefined
    );
    return;
  }

  // 6. Express JSON body parsing error
  if (
    err instanceof SyntaxError &&
    'status' in err &&
    (err as { status: unknown }).status === 400
  ) {
    sendError(res, 'INVALID_JSON', 'Malformed JSON in request body', 400);
    return;
  }

  // 7. Unhandled / Internal Server Error
  if (process.env.NODE_ENV !== 'test') {
    console.error('[UnhandledError]', err);
  }
  sendError(
    res,
    'INTERNAL_SERVER_ERROR',
    process.env.NODE_ENV === 'production'
      ? 'An unexpected internal server error occurred'
      : err.message,
    500,
    undefined,
    includeStack ? err.stack : undefined
  );
};

export const notFoundHandler = (req: Request, res: Response): void => {
  sendError(res, 'NOT_FOUND', `Cannot ${req.method} ${req.originalUrl} - endpoint not found`, 404);
};

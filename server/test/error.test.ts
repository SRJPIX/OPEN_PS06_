import { describe, it, expect } from 'vitest';
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { ApiError } from '../src/utils/apiError';
import { errorHandler } from '../src/middleware/error.middleware';

describe('Error Handling Middleware', () => {
  const createTestApp = () => {
    const app = express();
    app.use(express.json());

    // Route that throws ApiError
    app.get('/test/operational-error', () => {
      throw ApiError.badRequest('Invalid parameter supplied', { field: 'userId' });
    });

    // Route that throws unauthorized
    app.get('/test/unauthorized', () => {
      throw ApiError.unauthorized('Authentication token expired');
    });

    // Route that throws generic unhandled error
    app.get('/test/unexpected-error', () => {
      throw new Error('Unexpected database driver socket timeout');
    });

    // Route with next(ApiError)
    app.get('/test/next-error', (_req: Request, _res: Response, next: NextFunction) => {
      next(ApiError.conflict('User with this email already registered'));
    });

    app.use(errorHandler);
    return app;
  };

  const app = createTestApp();

  it('should format ApiError into consistent JSON error response with correct status code', async () => {
    const response = await request(app).get('/test/operational-error');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Invalid parameter supplied',
        details: { field: 'userId' },
      },
    });
  });

  it('should handle unauthorized error properly', async () => {
    const response = await request(app).get('/test/unauthorized');

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token expired',
      },
    });
  });

  it('should handle conflict error triggered via next(err)', async () => {
    const response = await request(app).get('/test/next-error');

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'CONFLICT',
        message: 'User with this email already registered',
      },
    });
  });

  it('should sanitize unexpected internal errors with 500 status code', async () => {
    const response = await request(app).get('/test/unexpected-error');

    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body.error).toHaveProperty('code', 'INTERNAL_SERVER_ERROR');
    expect(response.body.error).toHaveProperty('message');
  });
});

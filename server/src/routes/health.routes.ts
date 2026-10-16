import { Router, Request, Response } from 'express';
import { getDatabaseStatus, isDatabaseConnected } from '../config/db';
import { sendSuccess, sendError } from '../utils/apiResponse';

const router = Router();

/**
 * @route   GET /api/health
 * @desc    Liveness check - verifies that the Express API process is running
 * @access  Public
 */
router.get('/', (_req: Request, res: Response) => {
  const data = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    service: 'evidra-api',
    version: '0.1.0',
    environment: process.env.NODE_ENV || 'development',
    database: getDatabaseStatus(),
  };

  sendSuccess(res, data, 'Service is healthy');
});

/**
 * @route   GET /api/ready
 * @desc    Readiness check - verifies that database and external dependencies are ready to serve requests
 * @access  Public
 */
router.get('/ready', (_req: Request, res: Response) => {
  const dbConnected = isDatabaseConnected();
  const dbStatus = getDatabaseStatus();

  const checks = {
    database: dbStatus,
  };

  if (!dbConnected) {
    sendError(
      res,
      'SERVICE_NOT_READY',
      'Service is not ready to receive traffic: database is not connected',
      503,
      { ready: false, checks }
    );
    return;
  }

  sendSuccess(
    res,
    {
      ready: true,
      checks,
    },
    'Service is ready to receive traffic',
    200
  );
});

export default router;

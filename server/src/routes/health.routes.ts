import { Router, Request, Response } from 'express';
import { getDatabaseStatus } from '../config/db';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    service: 'evidra-api',
    version: '0.1.0',
    environment: process.env.NODE_ENV || 'development',
    database: getDatabaseStatus(),
  });
});

export default router;

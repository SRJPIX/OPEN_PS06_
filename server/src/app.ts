import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config/env';
import healthRoutes from './routes/health.routes';
import authRoutes from './routes/auth.routes';
import studentRoutes from './routes/student.routes';
import evidenceRoutes from './routes/evidence.routes';
import skillRoutes from './routes/skill.routes';
import jobRoutes from './routes/job.routes';
import jobSourceRoutes from './routes/jobSource.routes';
import matchingRoutes from './routes/matching.routes';
import resumeRoutes from './routes/resume.routes';
import applicationRoutes from './routes/application.routes';
import officerRoutes from './routes/officer.routes';
import { apiRateLimiter } from './middleware/rateLimiter';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { sendSuccess } from './utils/apiResponse';

export const createApp = (): Application => {
  const app = express();

  // 1. Security Headers via Helmet
  app.use(helmet());

  // 2. CORS - Allow configured frontend with credentials for HTTP-only cookies
  app.use(
    cors({
      origin: config.CLIENT_URL,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // 3. Body and Cookie Parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.text({ type: ['text/csv', 'text/plain'], limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // 4. HTTP Request Logger (disabled during automated test execution)
  if (config.NODE_ENV !== 'test') {
    app.use(morgan(config.NODE_ENV === 'production' ? 'combined' : 'dev'));
  }

  // 5. Global Rate Limiter for API endpoints
  app.use('/api', apiRateLimiter);

  // 6. Base Root Endpoint
  app.get('/', (_req: Request, res: Response) => {
    sendSuccess(res, {
      name: 'Evidra API',
      status: 'active',
      description: 'AI-Powered Placement Intelligence Platform API',
      version: '0.1.0',
      endpoints: {
        health: '/api/health',
        ready: '/api/ready',
        auth: '/api/auth',
        students: '/api/students',
        evidence: '/api/evidence',
        skills: '/api/skills',
        jobs: '/api/jobs',
        jobSources: '/api/jobs/sources',
        matching: '/api/matching',
        resumes: '/api/resumes',
        applications: '/api/applications',
      },
    });
  });

  // 7. Health & Readiness Routes
  app.use('/api/health', healthRoutes);
  // Direct readiness alias for GET /api/ready
  app.use('/api/ready', (req: Request, res: Response, next) => {
    req.url = '/ready';
    return healthRoutes(req, res, next);
  });

  // 8. Application Domain Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/students', studentRoutes);
  app.use('/api/evidence', evidenceRoutes);
  app.use('/api/skills', skillRoutes);
  app.use('/api/jobs/sources', jobSourceRoutes);
  app.use('/api/jobs', jobRoutes);
  app.use('/api/matching', matchingRoutes);
  app.use('/api/resumes', resumeRoutes);
  app.use('/api/applications', applicationRoutes);
  app.use('/api/officer', officerRoutes);

  // 9. 404 Handler for undefined routes
  app.use(notFoundHandler);

  // 10. Centralized Error Handler
  app.use(errorHandler);

  return app;
};

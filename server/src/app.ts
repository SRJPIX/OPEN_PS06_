import express, { Application, Request, Response, NextFunction } from 'express';
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
import recruiterRoutes from './routes/recruiter.routes';
import alumniRoutes from './routes/alumni.routes';
import interviewRoutes from './routes/interview.routes';
import { apiRateLimiter } from './middleware/rateLimiter';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { sendSuccess } from './utils/apiResponse';

export const createApp = (): Application => {
  const app = express();

  // Enable trust proxy for Render, Vercel, and reverse proxy deployments
  app.set('trust proxy', 1);

  // 1. Security Headers via Helmet
  app.use(helmet());

  // 2. CORS - Allow configured frontend(s) with credentials for HTTP-only cookies
  const allowedOrigins = (config.CLIENT_URL || '')
    .split(',')
    .map((url) => url.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  app.use(
    cors({
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        // Allow non-browser requests (Postman, curl, internal checks)
        if (!origin) return callback(null, true);
        const cleanOrigin = origin.replace(/\/+$/, '');
        if (
          allowedOrigins.includes(cleanOrigin) ||
          (config.NODE_ENV !== 'production' && cleanOrigin.includes('localhost'))
        ) {
          return callback(null, true);
        }
        // Allow Vercel preview deployments if production client URL contains vercel.app
        if (
          allowedOrigins.some((u) => u.includes('vercel.app')) &&
          /^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.vercel\.app$/i.test(cleanOrigin)
        ) {
          return callback(null, true);
        }
        return callback(null, false);
      },
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

  // 7. Health & Readiness Routes (supports both /health and /api/health)
  app.use('/api/health', healthRoutes);
  app.use('/health', healthRoutes);
  // Direct readiness alias for GET /ready and GET /api/ready
  app.use(['/api/ready', '/ready'], (req: Request, res: Response, next: NextFunction) => {
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
  app.use('/api/recruiter', recruiterRoutes);
  app.use('/api/alumni', alumniRoutes);
  app.use('/api/interviews', interviewRoutes);

  // 9. 404 Handler for undefined routes
  app.use(notFoundHandler);

  // 10. Centralized Error Handler
  app.use(errorHandler);

  return app;
};

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import morgan from 'morgan';
import healthRoutes from './routes/health.routes';

export const createApp = (): Application => {
  const app = express();

  // Security Middleware
  app.use(helmet());

  // CORS Middleware - configured for HTTP-only cookies
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  app.use(
    cors({
      origin: clientUrl,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // Body and Cookie Parsers
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // HTTP Request Logger (in development)
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // Root endpoint
  app.get('/', (_req: Request, res: Response) => {
    res.status(200).json({
      name: 'Evidra API',
      status: 'active',
      description: 'AI-Powered Placement Intelligence Platform API',
      healthCheck: '/api/health',
    });
  });

  // Health check route
  app.use('/api/health', healthRoutes);

  // 404 Handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not Found',
      message: 'The requested resource was not found on this server',
    });
  });

  // Global Error Handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[ServerError]', err);
    res.status(500).json({
      error: 'InternalServerError',
      message: process.env.NODE_ENV === 'production' ? 'An internal error occurred' : err.message,
    });
  });

  return app;
};

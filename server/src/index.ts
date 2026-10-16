import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app';
import { connectDB } from './config/db';

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  // Attempt DB connection
  await connectDB();

  const app = createApp();

  const server = app.listen(PORT, () => {
    console.log(
      `[Evidra API] Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`
    );
    console.log(`[Evidra API] Health check available at http://localhost:${PORT}/api/health`);
  });

  // Graceful shutdown
  const handleShutdown = () => {
    console.log('[Evidra API] Received termination signal. Closing server...');
    server.close(() => {
      console.log('[Evidra API] HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', handleShutdown);
  process.on('SIGINT', handleShutdown);
};

startServer().catch((error) => {
  console.error('[Evidra API] Fatal error starting server:', error);
  process.exit(1);
});

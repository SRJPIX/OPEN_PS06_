import { config } from './config/env';
import { createApp } from './app';
import { connectDB, disconnectDB } from './config/db';

const startServer = async () => {
  console.log(`[Evidra API] Initializing in ${config.NODE_ENV} environment...`);

  // 1. Establish MongoDB connection
  await connectDB(config.MONGODB_URI);

  // 2. Create Express app
  const app = createApp();

  // 3. Start listening
  const server = app.listen(config.PORT, () => {
    console.log(`[Evidra API] HTTP Server listening on port ${config.PORT}`);
    console.log(`[Evidra API] Liveness check: http://localhost:${config.PORT}/api/health`);
    console.log(`[Evidra API] Readiness check: http://localhost:${config.PORT}/api/ready`);
  });

  // 4. Graceful shutdown handler
  let isShuttingDown = false;
  const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\n[Evidra API] Received ${signal}. Initiating graceful shutdown...`);

    // Force exit timeout if graceful shutdown hangs
    const forceExitTimer = setTimeout(() => {
      console.error('[Evidra API] Graceful shutdown timed out. Forcing exit.');
      process.exit(1);
    }, 10000);
    forceExitTimer.unref();

    // Stop accepting new HTTP requests
    server.close(async () => {
      console.log('[Evidra API] HTTP server closed.');

      // Safely disconnect database
      await disconnectDB();

      console.log('[Evidra API] Graceful shutdown complete. Exiting process.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  process.on('unhandledRejection', (reason: unknown) => {
    console.error('[Evidra API] Unhandled Promise Rejection:', reason);
  });

  process.on('uncaughtException', (error: Error) => {
    console.error('[Evidra API] Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
  });
};

startServer().catch((error) => {
  console.error('[Evidra API] Fatal startup failure:', error);
  process.exit(1);
});

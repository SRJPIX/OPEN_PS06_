import dns from 'node:dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);
import { config } from './config/env';
import { createApp } from './app';
import { connectDB, disconnectDB } from './config/db';
import { seedDemoUsers } from './utils/seed';

const startServer = async () => {
  console.log(`[Evidra API] Initializing in ${config.NODE_ENV} environment...`);

  // 1. Establish MongoDB connection
  const dbConnected = await connectDB(config.MONGODB_URI);

  if (!dbConnected) {
    const maskedUri = config.MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
    if (config.NODE_ENV === 'production') {
      throw new Error(
        `[Evidra API] Fatal: Database connection to '${maskedUri}' failed. The application cannot start in production without an active MongoDB connection.`
      );
    } else {
      console.error(
        `[Evidra API] WARNING: Database connection to '${maskedUri}' could not be established. Ensure local MongoDB service is running or check MONGODB_URI in .env. Database-dependent routes will return 503.`
      );
    }
  }

  // 2. Optional development-only demo user seed
  if (dbConnected && config.SEED_DEMO_USERS && config.NODE_ENV !== 'production') {
    try {
      await seedDemoUsers();
    } catch (err) {
      console.error('[Evidra API] Error seeding demo users on startup:', err);
    }
  }

  // 3. Create Express app
  const app = createApp();

  // 4. Start listening
  const server = app.listen(config.PORT, () => {
    console.log(`[Evidra API] HTTP Server listening on port ${config.PORT}`);
    console.log(
      `[Evidra API] Database status: ${dbConnected ? 'CONNECTED' : 'DISCONNECTED (Degraded)'}`
    );
    console.log(`[Evidra API] Liveness check: http://localhost:${config.PORT}/api/health`);
    console.log(`[Evidra API] Readiness check: http://localhost:${config.PORT}/api/ready`);
    console.log(`[Evidra API] Auth endpoints: http://localhost:${config.PORT}/api/auth`);
  });

  // 5. Graceful shutdown handler
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

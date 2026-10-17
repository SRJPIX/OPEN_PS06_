import { config } from '../config/env';
import { connectDB, disconnectDB, isDatabaseConnected } from '../config/db';
import { seedDemoJobs } from '../utils/demoJobsSeed';

/**
 * Standalone CLI script to idempotently seed 30 realistic demo jobs into MongoDB.
 * Run via:
 *   npm run seed:jobs --workspace=server
 * or from root:
 *   npm run seed:jobs
 */
const run = async () => {
  if (config.NODE_ENV === 'production') {
    console.error('[SeedJobs] Error: Cannot seed demo jobs in production environment!');
    process.exit(1);
  }

  console.log('[SeedJobs] Connecting to MongoDB...');
  const connected = await connectDB(config.MONGODB_URI);
  if (!connected || !isDatabaseConnected()) {
    console.error('[SeedJobs] Error: Could not connect to MongoDB. Please ensure MongoDB is running and MONGODB_URI is valid.');
    process.exit(1);
  }

  try {
    console.log('[SeedJobs] Starting idempotent seeding of 30 realistic demo jobs...');
    const result = await seedDemoJobs();

    console.log('--------------------------------------------------');
    console.log('[SeedJobs] Summary of Seeding Results:');
    console.log(` - Newly created jobs:              ${result.createdCount}`);
    console.log(` - Already present (skipped):       ${result.skippedCount}`);
    console.log(` - Total active demo requisitions:  ${result.totalActiveDemoJobs}`);
    console.log('--------------------------------------------------');
    console.log('[SeedJobs] Demo job seeding finished successfully.');
  } catch (error) {
    console.error('[SeedJobs] Fatal error during demo job seeding:', error);
    process.exit(1);
  } finally {
    await disconnectDB();
  }
};

run();


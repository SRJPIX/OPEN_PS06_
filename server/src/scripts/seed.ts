import { config } from '../config/env';
import { connectDB, disconnectDB } from '../config/db';
import { runSafeSeed } from '../utils/safeSeed';
import { seedDemoUsers } from '../utils/seed';

const run = async () => {
  if (config.NODE_ENV === 'production') {
    console.error('[Seed] Cannot run seed script in production!');
    process.exit(1);
  }

  const connected = await connectDB(config.MONGODB_URI);
  if (!connected) {
    console.error('[Seed] Could not connect to database. Ensure MongoDB is running.');
    process.exit(1);
  }

  try {
    if (process.argv.includes('--full') || process.argv.includes('--reset')) {
      console.log('[Seed] Running full reset demonstration seed...');
      await seedDemoUsers();
    } else {
      console.log('[Seed] Running safe non-destructive development seed...');
      await runSafeSeed();
    }
    console.log('[Seed] Seeding completed successfully.');
  } catch (error) {
    console.error('[Seed] Error seeding demo users:', error);
    process.exit(1);
  } finally {
    await disconnectDB();
  }
};

run();

import { config } from '../config/env';
import { connectDB, disconnectDB } from '../config/db';
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
    await seedDemoUsers();
    console.log('[Seed] Seeding completed successfully.');
  } catch (error) {
    console.error('[Seed] Error seeding demo users:', error);
    process.exit(1);
  } finally {
    await disconnectDB();
  }
};

run();

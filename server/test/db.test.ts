import { describe, it, expect, afterAll } from 'vitest';
import { connectDB, disconnectDB, getDatabaseStatus, isDatabaseConnected } from '../src/config/db';

describe('Database Connection Lifecycle', () => {
  afterAll(async () => {
    await disconnectDB();
  });

  it('should accurately report disconnected status before connection', () => {
    expect(['disconnected', 'connecting']).toContain(getDatabaseStatus());
    expect(typeof isDatabaseConnected()).toBe('boolean');
  });

  it('should handle invalid or unreachable MongoDB URI gracefully without throwing', async () => {
    const unreachableUri =
      'mongodb://127.0.0.1:27019/unreachable_test?serverSelectionTimeoutMS=1000';
    const connected = await connectDB(unreachableUri, { serverSelectionTimeoutMS: 1000 });

    expect(connected).toBe(false);
    expect(isDatabaseConnected()).toBe(false);
  }, 8000);

  it('should handle placeholder credentials gracefully without crashing', async () => {
    const placeholderUri = 'mongodb+srv://<username>:<password>@cluster.mongodb.net/evidra';
    const connected = await connectDB(placeholderUri);

    expect(connected).toBe(false);
    expect(isDatabaseConnected()).toBe(false);
  });
});

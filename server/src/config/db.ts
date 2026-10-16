import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  const uri = process.env.MONGODB_URI;

  if (!uri || uri.includes('<username>') || uri.includes('example')) {
    console.warn(
      '[Database] MONGODB_URI is not set or contains placeholder credentials. Initial health-check running without active MongoDB connection.'
    );
    return;
  }

  try {
    const conn = await mongoose.connect(uri);
    console.log(`[Database] MongoDB Atlas Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('[Database] MongoDB connection error:', error);
  }
};

export const getDatabaseStatus = (): string => {
  switch (mongoose.connection.readyState) {
    case 0:
      return 'disconnected';
    case 1:
      return 'connected';
    case 2:
      return 'connecting';
    case 3:
      return 'disconnecting';
    default:
      return 'unknown';
  }
};

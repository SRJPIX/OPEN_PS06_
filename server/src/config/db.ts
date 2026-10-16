import mongoose, { ConnectOptions } from 'mongoose';

export type DatabaseStatus =
  'connected' | 'connecting' | 'disconnecting' | 'disconnected' | 'unknown';

let isListenersAttached = false;

const attachConnectionListeners = (): void => {
  if (isListenersAttached) return;

  mongoose.connection.on('connected', () => {
    console.log('[MongoDB] Database connection established successfully.');
  });

  mongoose.connection.on('error', (err) => {
    if (process.env.NODE_ENV !== 'test') {
      console.error('[MongoDB] Database connection error:', err);
    }
  });

  mongoose.connection.on('disconnected', () => {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[MongoDB] Database connection lost/disconnected.');
    }
  });

  mongoose.connection.on('reconnected', () => {
    console.log('[MongoDB] Database connection re-established.');
  });

  isListenersAttached = true;
};

export const getDatabaseStatus = (): DatabaseStatus => {
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

export const isDatabaseConnected = (): boolean => {
  return mongoose.connection.readyState === 1;
};

export const connectDB = async (uri?: string, options?: ConnectOptions): Promise<boolean> => {
  attachConnectionListeners();

  const mongoUri = uri || process.env.MONGODB_URI;

  if (!mongoUri || mongoUri.includes('<username>') || mongoUri.includes('placeholder')) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(
        '[MongoDB] MONGODB_URI is not set or contains placeholder credentials. Initial health-check running without active MongoDB connection.'
      );
    }
    return false;
  }

  // If already connected, do not reconnect
  if (mongoose.connection.readyState === 1) {
    return true;
  }

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 3000,
      autoIndex: process.env.NODE_ENV !== 'production',
      ...options,
    });
    console.log(
      `[MongoDB] Connected to host: ${conn.connection.host} (DB: ${conn.connection.name})`
    );
    return true;
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('[MongoDB] Initial connection failure:', error);
    }
    return false;
  }
};

export const disconnectDB = async (): Promise<void> => {
  if (mongoose.connection.readyState !== 0) {
    try {
      await mongoose.disconnect();
      if (process.env.NODE_ENV !== 'test') {
        console.log('[MongoDB] Database disconnected cleanly.');
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('[MongoDB] Error during disconnect:', error);
      }
    }
  }
};

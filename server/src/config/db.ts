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

export interface DatabaseInfo {
  status: DatabaseStatus;
  connected: boolean;
  databaseName?: string;
  host?: string;
}

export const getDatabaseInfo = (): DatabaseInfo => {
  const status = getDatabaseStatus();
  const connected = isDatabaseConnected();
  let databaseName: string | undefined;
  let host: string | undefined;

  if (mongoose.connection && mongoose.connection.readyState === 1) {
    databaseName = mongoose.connection.name || undefined;
    if (mongoose.connection.host) {
      host = mongoose.connection.host.replace(/.*@/, '');
    }
  }

  return {
    status,
    connected,
    ...(databaseName ? { databaseName } : {}),
    ...(host ? { host } : {}),
  };
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
    const safeHost = conn.connection.host ? conn.connection.host.replace(/.*@/, '') : 'configured-host';
    console.log(
      `[MongoDB] Connected to host: ${safeHost} (DB: ${conn.connection.name})`
    );
    return true;
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('[MongoDB] Initial connection failure:', error);
    }
    // In development mode, if remote cluster fails (e.g. IP not whitelisted on Atlas),
    // attempt fallback to local MongoDB so local testing is never blocked by timeout.
    if (
      process.env.NODE_ENV !== 'production' &&
      !mongoUri.includes('localhost') &&
      !mongoUri.includes('127.0.0.1')
    ) {
      try {
        console.warn(
          '[MongoDB] Remote cluster unreachable (likely IP whitelist). Attempting fallback to local MongoDB at mongodb://localhost:27017/evidra...'
        );
        const fallbackConn = await mongoose.connect('mongodb://localhost:27017/evidra', {
          serverSelectionTimeoutMS: 2000,
          autoIndex: true,
          ...options,
        });
        console.log(
          `[MongoDB] Connected to local fallback host: ${fallbackConn.connection.host} (DB: ${fallbackConn.connection.name})`
        );
        return true;
      } catch (fallbackErr) {
        if (process.env.NODE_ENV !== 'test') {
          console.error('[MongoDB] Local fallback connection also failed:', fallbackErr);
        }
      }
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

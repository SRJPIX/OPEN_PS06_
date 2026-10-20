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
      serverSelectionTimeoutMS: 10000,
      autoIndex: process.env.NODE_ENV !== 'production',
      ...options,
    });
    const safeHost = conn.connection.host ? conn.connection.host.replace(/.*@/, '') : 'configured-host';
    console.log(
      `[MongoDB] Connected to host: ${safeHost} (DB: ${conn.connection.name})`
    );
    return true;
  } catch (error: any) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('[MongoDB] Initial connection failure:', error);
      const isTlsAlert =
        error?.message?.includes('tlsv1 alert internal error') ||
        error?.cause?.code === 'ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR' ||
        error?.message?.includes('SSL alert number 80') ||
        error?.cause?.message?.includes('tlsv1 alert internal error');

      if (isTlsAlert) {
        console.error(
          '\n[MongoDB Atlas Diagnostic] Remote Atlas host rejected the TLS handshake with alert 80 (internal error).' +
          '\n  This occurs when:' +
          '\n  1. Your current public IP is not in Atlas Network Access list (Security -> Network Access -> Add Current IP).' +
          '\n  2. The Atlas cluster is currently Paused (Database Deployments -> Resume).'
        );
      }

      const isLocalConnRefused =
        (mongoUri.includes('127.0.0.1') || mongoUri.includes('localhost')) &&
        (error?.message?.includes('ECONNREFUSED') ||
          error?.cause?.code === 'ECONNREFUSED' ||
          error?.message?.includes('serverSelectionTimeoutMS'));

      if (isLocalConnRefused) {
        console.error(
          '\n[Local MongoDB Diagnostic] Could not connect to local MongoDB on 127.0.0.1:27017 (service not running or connection refused).' +
          '\n  To start the Windows MongoDB service, run in PowerShell:' +
          '\n    Start-Service MongoDB' +
          '\n  To check service status:' +
          '\n    Get-Service MongoDB'
        );
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

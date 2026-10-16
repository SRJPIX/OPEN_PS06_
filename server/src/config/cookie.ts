import { CookieOptions } from 'express';
import { config } from './env';

/**
 * Returns cookie options for setting authentication tokens.
 * Secure in production with sameSite=none for cross-origin deployments (e.g. Render <-> Vercel),
 * and lax in local development for localhost compatibility.
 */
export const getAuthCookieOptions = (): CookieOptions => {
  const isProd = config.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    path: '/',
  };
};

/**
 * Returns cookie options for clearing authentication tokens upon logout.
 */
export const getClearCookieOptions = (): CookieOptions => {
  const isProd = config.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
  };
};

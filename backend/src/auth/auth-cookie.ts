import type { CookieOptions } from 'express';
import { ACCESS_TOKEN_TTL_MS } from './auth.constants.js';

export function authCookieOptions(isProduction: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_TOKEN_TTL_MS,
  };
}

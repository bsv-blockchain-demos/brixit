import type { Request, Response, NextFunction } from 'express';
import * as jose from 'jose';
import { config } from '../config.js';

// Extend Express Request to include user info
export interface AuthenticatedRequest extends Request {
  user?: {
    sub: string;       // user id
    email?: string;
    roles: string[];
    display_name?: string;
  };
}

const secret = new TextEncoder().encode(config.jwtSecret);

/**
 * Middleware that verifies JWT from Authorization: Bearer <token> header.
 * Populates req.user on success.
 */
export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }

    const token = authHeader.slice(7);
    const { payload } = await jose.jwtVerify(token, secret);

    req.user = {
      sub: payload.sub as string,
      email: payload.email as string | undefined,
      roles: (payload.roles as string[]) || [],
      display_name: payload.display_name as string | undefined,
    };

    next();
  } catch (err: any) {
    if (err?.code === 'ERR_JWT_EXPIRED') {
      res.status(401).json({ error: 'Token expired' });
      return;
    }
    console.error('[AUTH] Token verification failed:', err.message);
    res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Middleware that requires the authenticated user to have the 'admin' role.
 * Must be used after requireAuth.
 */
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  if (!req.user.roles.includes('admin')) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

/**
 * Middleware that requires the authenticated user to have 'admin' or 'contributor' role.
 * Must be used after requireAuth.
 */
export function requireContributor(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  if (!req.user.roles.includes('admin') && !req.user.roles.includes('contributor')) {
    res.status(403).json({ error: 'Contributor or admin access required' });
    return;
  }
  next();
}

/**
 * Optional auth — populates req.user if a valid token is present, but doesn't reject if missing.
 */
export async function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const { payload } = await jose.jwtVerify(token, secret);
      req.user = {
        sub: payload.sub as string,
        email: payload.email as string | undefined,
        roles: (payload.roles as string[]) || [],
        display_name: payload.display_name as string | undefined,
      };
    }
  } catch {
    // Token invalid or expired — continue without user
  }
  next();
}

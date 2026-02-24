/**
 * Authentication routes (wallet-only).
 *
 * Endpoints:
 *   POST /api/auth/wallet-login  → Wallet login (in walletAuthVerify.ts)
 *   POST /api/auth/refresh       → Refresh access token using HttpOnly cookie
 *   POST /api/auth/logout        → Clear refresh token cookie
 *   GET  /api/auth/me            → Validate token + return current user info
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import * as jose from 'jose';
import { config } from '../config.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import prisma from '../db/client.js';

const router = Router();

const jwtSecret = new TextEncoder().encode(config.jwtSecret);

/** Parse a named cookie from the Cookie request header without cookie-parser. */
function parseCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

/** Build a Set-Cookie header string for the refresh token. */
function buildRefreshCookieHeader(value: string, maxAgeSeconds: number): string {
  const secure = config.nodeEnv === 'production' ? '; Secure' : '';
  return `refresh_token=${encodeURIComponent(value)}; HttpOnly; SameSite=Strict; Path=/api/auth; Max-Age=${maxAgeSeconds}${secure}`;
}

/** Build a Set-Cookie header that clears the refresh token. */
function clearRefreshCookieHeader(): string {
  const secure = config.nodeEnv === 'production' ? '; Secure' : '';
  return `refresh_token=; HttpOnly; SameSite=Strict; Path=/api/auth; Max-Age=0${secure}`;
}

// --- POST /api/auth/refresh ---

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const refresh_token = parseCookie(req.headers.cookie, 'refresh_token');

    if (!refresh_token) {
      res.status(401).json({ error: 'No refresh token' });
      return;
    }

    // Verify the refresh token
    const { payload } = await jose.jwtVerify(refresh_token, jwtSecret);

    if (payload.type !== 'refresh') {
      res.status(401).json({ error: 'Invalid token type' });
      return;
    }

    const userId = payload.sub as string;

    // Fetch user from DB to get current roles/display_name
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true },
    });

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    const roleNames = user.roles.map((r: { role: string }) => r.role);

    const accessToken = await new jose.SignJWT({
      sub: userId,
      email: user.email,
      display_name: user.displayName,
      roles: roleNames,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(config.jwtAccessExpiry)
      .sign(jwtSecret);

    // Rotate the refresh token
    const newRefreshToken = await new jose.SignJWT({ sub: userId, type: 'refresh' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(config.jwtRefreshExpiry)
      .sign(jwtSecret);

    res.setHeader('Set-Cookie', buildRefreshCookieHeader(newRefreshToken, 7 * 24 * 60 * 60));
    res.json({ access_token: accessToken });
  } catch (err: any) {
    if (err?.code === 'ERR_JWT_EXPIRED') {
      res.setHeader('Set-Cookie', clearRefreshCookieHeader());
      res.status(401).json({ error: 'Refresh token expired, please login again' });
      return;
    }
    console.error('[auth/refresh] Error:', err);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// --- POST /api/auth/logout ---

router.post('/logout', (_req: Request, res: Response) => {
  res.setHeader('Set-Cookie', clearRefreshCookieHeader());
  res.json({ success: true, message: 'Logged out successfully' });
});

// --- GET /api/auth/me ---

router.get('/me', requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.sub;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        display_name: user.displayName,
        country: user.country,
        state: user.state,
        city: user.city,
        points: user.points,
        submission_count: user.submissionCount,
        roles: user.roles.map((r: { role: string }) => r.role),
        created_at: user.createdAt,
      },
    });
  } catch (err) {
    console.error('[auth/me] Error:', err);
    res.status(500).json({ error: 'Failed to fetch user info' });
  }
});

export default router;

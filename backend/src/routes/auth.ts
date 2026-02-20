/**
 * Authentication routes (wallet-only).
 *
 * Endpoints:
 *   POST /api/auth/wallet-login  → Wallet login (in walletAuthVerify.ts)
 *   POST /api/auth/refresh       → Refresh access token
 *   POST /api/auth/logout        → Logout (client discards tokens)
 *   GET  /api/auth/me            → Validate token + return current user info
 *
 * No email/password auth — all authentication is via BSV wallet certificates.
 * DB calls are stubbed with TODO comments until the database layer is decided.
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import * as jose from 'jose';
import { config } from '../config.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import prisma from '../db/client.js';

const router = Router();

const jwtSecret = new TextEncoder().encode(config.jwtSecret);

// --- POST /api/auth/refresh ---

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      res.status(400).json({ error: 'refresh_token is required' });
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

    res.json({ access_token: accessToken });
  } catch (err: any) {
    if (err?.code === 'ERR_JWT_EXPIRED') {
      res.status(401).json({ error: 'Refresh token expired, please login again' });
      return;
    }
    console.error('[auth/refresh] Error:', err);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// --- POST /api/auth/logout ---

router.post('/logout', async (_req: Request, res: Response) => {
  // With stateless JWTs, logout is handled client-side by discarding tokens.
  // If we add a token blacklist later, it would go here.
  res.json({ success: true, message: 'Logged out successfully' });
});

// --- GET /api/auth/me (validate token + return user info) ---

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

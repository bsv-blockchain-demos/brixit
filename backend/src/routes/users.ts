/**
 * User profile routes (authenticated).
 *
 * Endpoints:
 *   GET  /api/users/me → Current user's full profile
 *   PUT  /api/users/me → Update profile (display_name, location fields)
 */
import { Router } from 'express';
import type { Response } from 'express';
import prisma from '../db/client.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/users/me
router.get('/me', requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      include: { roles: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      id: user.id,
      email: user.email,
      display_name: user.displayName,
      country: user.country,
      state: user.state,
      city: user.city,
      location_lat: user.locationLat,
      location_lng: user.locationLng,
      points: user.points,
      submission_count: user.submissionCount,
      last_submission: user.lastSubmission,
      created_at: user.createdAt,
      roles: user.roles.map((r: { role: string }) => r.role),
    });
  } catch (err) {
    console.error('[users/me GET] Error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PUT /api/users/me
router.put('/me', requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { display_name, country, state, city } = req.body;

    const updated = await prisma.user.update({
      where: { id: req.user!.sub },
      data: {
        ...(display_name !== undefined && { displayName: display_name }),
        ...(country !== undefined && { country }),
        ...(state !== undefined && { state }),
        ...(city !== undefined && { city }),
      },
    });

    res.json({
      id: updated.id,
      display_name: updated.displayName,
      country: updated.country,
      state: updated.state,
      city: updated.city,
    });
  } catch (err) {
    console.error('[users/me PUT] Error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;

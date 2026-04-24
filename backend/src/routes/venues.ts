import { Router } from 'express';
import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import prisma from '../db/client.js';
import { sanitizeInput } from '../utils/sanitize.js';

const router = Router();

const NEARBY_RADIUS_DEG = 0.0009; // ~100m at equator

// GET /api/venues/nearby?lat=&lng=
router.get('/nearby', async (req: Request, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    if (isNaN(lat) || isNaN(lng)) {
      res.status(400).json({ error: 'lat and lng are required' });
      return;
    }

    const venues = await prisma.$queryRaw<{
      id: string; name: string; pos_type: string | null;
      verified: boolean; submission_count: bigint; distance_deg: number;
    }[]>`
      SELECT
        v.id,
        v.name,
        v.pos_type,
        v.verified,
        COUNT(s.id) AS submission_count,
        SQRT(POWER(v.latitude  - ${lat}, 2) + POWER(v.longitude - ${lng}, 2)) AS distance_deg
      FROM venues v
      LEFT JOIN submissions s ON s.venue_id = v.id
      WHERE ABS(v.latitude  - ${lat})  < ${NEARBY_RADIUS_DEG}
        AND ABS(v.longitude - ${lng}) < ${NEARBY_RADIUS_DEG}
      GROUP BY v.id
      ORDER BY submission_count DESC
      LIMIT 2
    `;

    res.json(venues.map(v => ({
      id: v.id,
      name: v.name,
      posType: v.pos_type,
      verified: v.verified,
      submissionCount: Number(v.submission_count),
    })));
  } catch (err) {
    console.error('[venues/nearby]', err);
    res.status(500).json({ error: 'Failed to fetch nearby venues' });
  }
});

// POST /api/venues — contributor+, deduplicated
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, posType, latitude, longitude } = req.body;
    const cleanName = sanitizeInput(name);
    if (!cleanName) { res.status(400).json({ error: 'name is required' }); return; }
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lng)) { res.status(400).json({ error: 'latitude and longitude are required' }); return; }

    const existing = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM venues
      WHERE lower(name) = lower(${cleanName})
        AND ABS(latitude  - ${lat}) < ${NEARBY_RADIUS_DEG}
        AND ABS(longitude - ${lng}) < ${NEARBY_RADIUS_DEG}
      LIMIT 1
    `;

    if (existing.length > 0) {
      const venue = await prisma.venue.findUnique({ where: { id: existing[0].id } });
      res.json({ ...venue, isExisting: true });
      return;
    }

    const venue = await prisma.venue.create({
      data: {
        name: cleanName,
        posType: sanitizeInput(posType) ?? null,
        latitude: lat,
        longitude: lng,
        verified: false,
        createdByUserId: (req as AuthenticatedRequest).user?.sub ?? null,
      },
    });
    res.status(201).json({ ...venue, isExisting: false });
  } catch (err) {
    console.error('[venues POST]', err);
    res.status(500).json({ error: 'Failed to create venue' });
  }
});

export default router;

/**
 * Location data routes (public).
 *
 * Endpoints:
 *   GET /api/locations → List all locations (id, name, label), ordered by name
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../db/client.js';

const router = Router();

// GET /api/locations
router.get('/', async (_req: Request, res: Response) => {
  try {
    const locations = await prisma.location.findMany({
      select: { id: true, name: true, label: true },
      orderBy: { name: 'asc' },
    });
    res.json(locations);
  } catch (err) {
    console.error('[locations] Error:', err);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

export default router;

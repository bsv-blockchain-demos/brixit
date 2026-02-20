/**
 * Brand data routes (public).
 *
 * Endpoints:
 *   GET /api/brands → List all brands (id, name, label), ordered by label
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../db/client.js';

const router = Router();

// GET /api/brands
router.get('/', async (_req: Request, res: Response) => {
  try {
    const brands = await prisma.brand.findMany({
      select: { id: true, name: true, label: true },
      orderBy: { label: 'asc' },
    });
    res.json(brands);
  } catch (err) {
    console.error('[brands] Error:', err);
    res.status(500).json({ error: 'Failed to fetch brands' });
  }
});

export default router;

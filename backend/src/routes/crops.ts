/**
 * Crop data routes (public).
 *
 * Endpoints:
 *   GET /api/crops              → List all crops (id, name, label), ordered by label
 *   GET /api/crops/categories   → List unique crop categories
 *   GET /api/crops/:name        → Single crop with brix thresholds
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../db/client.js';

const router = Router();

// GET /api/crops
router.get('/', async (_req: Request, res: Response) => {
  try {
    const crops = await prisma.crop.findMany({
      select: { id: true, name: true, label: true },
      orderBy: { label: 'asc' },
    });
    res.json(crops);
  } catch (err) {
    console.error('[crops] Error:', err);
    res.status(500).json({ error: 'Failed to fetch crops' });
  }
});

// GET /api/crops/thresholds — all crops with brix thresholds (for CropThresholdContext)
router.get('/thresholds', async (_req: Request, res: Response) => {
  try {
    const crops = await prisma.crop.findMany({
      select: { name: true, poorBrix: true, averageBrix: true, goodBrix: true, excellentBrix: true },
      orderBy: { name: 'asc' },
    });
    const result: Record<string, { poor: number; average: number; good: number; excellent: number }> = {};
    for (const c of crops) {
      const key = c.name.toLowerCase().trim();
      result[key] = {
        poor: c.poorBrix ? Number(c.poorBrix) : 0,
        average: c.averageBrix ? Number(c.averageBrix) : 0,
        good: c.goodBrix ? Number(c.goodBrix) : 0,
        excellent: c.excellentBrix ? Number(c.excellentBrix) : 0,
      };
    }
    res.json(result);
  } catch (err) {
    console.error('[crops/thresholds] Error:', err);
    res.status(500).json({ error: 'Failed to fetch crop thresholds' });
  }
});

// GET /api/crops/categories
router.get('/categories', async (_req: Request, res: Response) => {
  try {
    const crops = await prisma.crop.findMany({
      where: { category: { not: null } },
      select: { category: true },
      orderBy: { category: 'asc' },
    });
    const categories = [...new Set(crops.map((c: { category: string | null }) => c.category).filter(Boolean))];
    res.json(categories);
  } catch (err) {
    console.error('[crops/categories] Error:', err);
    res.status(500).json({ error: 'Failed to fetch crop categories' });
  }
});

// GET /api/crops/:name
router.get('/:name', async (req: Request, res: Response) => {
  try {
    const crop = await prisma.crop.findFirst({
      where: { name: { equals: req.params.name, mode: 'insensitive' } },
    });
    if (!crop) {
      res.status(404).json({ error: 'Crop not found' });
      return;
    }
    res.json({
      id: crop.id,
      name: crop.name,
      label: crop.label,
      brixLevels: {
        poor: crop.poorBrix ? Number(crop.poorBrix) : 0,
        average: crop.averageBrix ? Number(crop.averageBrix) : 0,
        good: crop.goodBrix ? Number(crop.goodBrix) : 0,
        excellent: crop.excellentBrix ? Number(crop.excellentBrix) : 0,
      },
    });
  } catch (err) {
    console.error('[crops/:name] Error:', err);
    res.status(500).json({ error: 'Failed to fetch crop' });
  }
});

export default router;

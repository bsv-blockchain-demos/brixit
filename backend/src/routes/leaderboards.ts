/**
 * Leaderboard routes (public).
 *
 * Endpoints:
 *   GET /api/leaderboards/brand    → Brand leaderboard (calls get_brand_leaderboard SQL function)
 *   GET /api/leaderboards/crop     → Crop leaderboard
 *   GET /api/leaderboards/location → Location leaderboard
 *   GET /api/leaderboards/user     → User leaderboard (safe, no PII)
 *
 * Query params: country, state, city, crop, limit, offset
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../db/client.js';

const router = Router();

function sanitizeFilter(value?: string): string | null {
  if (!value || value === 'All countries' || value === 'All states' || value === 'All cities') {
    return null;
  }
  return value;
}

function parseIntParam(value: unknown, defaultVal: number): number {
  const n = Number(value);
  return isNaN(n) ? defaultVal : n;
}

function normalizeNumericFields(rows: any[]): any[] {
  return rows.map((item: any) => {
    for (const field of ['average_normalized_score', 'average_brix', 'submission_count', 'rank']) {
      if (item[field] !== null && item[field] !== undefined) {
        const val = Number(item[field]);
        item[field] = isNaN(val) ? 0 : val;
      }
    }
    return item;
  });
}

// GET /api/leaderboards/brand
router.get('/brand', async (req: Request, res: Response) => {
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM get_brand_leaderboard($1::text, $2::text, $3::text, $4::text, $5::integer, $6::integer)`,
      sanitizeFilter(req.query.country as string),
      sanitizeFilter(req.query.state as string),
      sanitizeFilter(req.query.city as string),
      sanitizeFilter(req.query.crop as string),
      parseIntParam(req.query.limit, 50),
      parseIntParam(req.query.offset, 0),
    );
    res.json(normalizeNumericFields(rows as any[]));
  } catch (err) {
    console.error('[leaderboards/brand] Error:', err);
    res.status(500).json({ error: 'Failed to fetch brand leaderboard' });
  }
});

// GET /api/leaderboards/crop
router.get('/crop', async (req: Request, res: Response) => {
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM get_crop_leaderboard($1::text, $2::text, $3::text, $4::text, $5::integer, $6::integer)`,
      sanitizeFilter(req.query.country as string),
      sanitizeFilter(req.query.state as string),
      sanitizeFilter(req.query.city as string),
      sanitizeFilter(req.query.crop as string),
      parseIntParam(req.query.limit, 50),
      parseIntParam(req.query.offset, 0),
    );
    res.json(normalizeNumericFields(rows as any[]));
  } catch (err) {
    console.error('[leaderboards/crop] Error:', err);
    res.status(500).json({ error: 'Failed to fetch crop leaderboard' });
  }
});

// GET /api/leaderboards/location
router.get('/location', async (req: Request, res: Response) => {
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM get_location_leaderboard($1::text, $2::text, $3::text, $4::text, $5::integer, $6::integer)`,
      sanitizeFilter(req.query.country as string),
      sanitizeFilter(req.query.state as string),
      sanitizeFilter(req.query.city as string),
      sanitizeFilter(req.query.crop as string),
      parseIntParam(req.query.limit, 50),
      parseIntParam(req.query.offset, 0),
    );
    res.json(normalizeNumericFields(rows as any[]));
  } catch (err) {
    console.error('[leaderboards/location] Error:', err);
    res.status(500).json({ error: 'Failed to fetch location leaderboard' });
  }
});

// GET /api/leaderboards/user
router.get('/user', async (req: Request, res: Response) => {
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM get_user_leaderboard_safe($1::text, $2::text, $3::text, $4::text, $5::integer, $6::integer)`,
      sanitizeFilter(req.query.country as string),
      sanitizeFilter(req.query.state as string),
      sanitizeFilter(req.query.city as string),
      sanitizeFilter(req.query.crop as string),
      parseIntParam(req.query.limit, 50),
      parseIntParam(req.query.offset, 0),
    );
    res.json(normalizeNumericFields(rows as any[]));
  } catch (err) {
    console.error('[leaderboards/user] Error:', err);
    res.status(500).json({ error: 'Failed to fetch user leaderboard' });
  }
});

export default router;

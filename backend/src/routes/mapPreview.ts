import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../db/client.js';

const CACHE_TTL = 5 * 60 * 1000;
let previewCache: { data: object; ts: number } | null = null;

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  if (previewCache && Date.now() - previewCache.ts < CACHE_TTL) {
    return res.json(previewCache.data);
  }

  try {
    // Single aggregation query — groups verified submissions into 2° grid cells,
    // returns up to 8 clusters sorted by density. No JS grouping needed.
    const rows = await prisma.$queryRaw<Array<{ lat: number; lng: number; count: bigint }>>`
      SELECT
        AVG(v.latitude)::float  AS lat,
        AVG(v.longitude)::float AS lng,
        COUNT(*)                AS count
      FROM submissions s
      JOIN venues v ON s.venue_id = v.id
      WHERE s.verified = true
        AND v.latitude  IS NOT NULL
        AND v.longitude IS NOT NULL
      GROUP BY
        ROUND(v.latitude::numeric  / 2) * 2,
        ROUND(v.longitude::numeric / 2) * 2
      ORDER BY count DESC
      LIMIT 8
    `;

    const clusters = rows.map(r => ({
      lat:   Number(r.lat),
      lng:   Number(r.lng),
      count: Number(r.count),
    }));

    console.log(`[map-preview] ${clusters.length} clusters from DB`);

    if (clusters.length === 0) {
      return res.json({ center: { lat: 20, lng: 0 }, zoom: 2, clusters: [] });
    }

    // Fetch a representative sample submission for the top 2 clusters in parallel
    const withSamples = await Promise.all(
      clusters.map(async (c, i) => {
        if (i >= 2) return c;
        const row = await prisma.submission.findFirst({
          where: {
            verified: true,
            venue: {
              latitude:  { gte: c.lat - 1, lte: c.lat + 1 },
              longitude: { gte: c.lng - 1, lte: c.lng + 1 },
            },
          },
          include: {
            crop:  { select: { label: true, poorBrix: true, excellentBrix: true } },
            venue: { select: { name: true, city: true } },
          },
          orderBy: { assessmentDate: 'desc' },
        });
        if (!row) return c;
        return {
          ...c,
          sample: {
            brixValue:     Number(row.brixValue),
            cropLabel:     row.crop.label,
            cropVariety:   row.cropVariety ?? null,
            venueName:     row.venue?.name ?? null,
            venueCity:     row.venue?.city ?? null,
            poorBrix:      row.crop.poorBrix     != null ? Number(row.crop.poorBrix)     : null,
            excellentBrix: row.crop.excellentBrix != null ? Number(row.crop.excellentBrix) : null,
          },
        };
      }),
    );

    const allLats = clusters.map(c => c.lat);
    const allLngs = clusters.map(c => c.lng);
    const centerLat = (Math.max(...allLats) + Math.min(...allLats)) / 2;
    const centerLng = (Math.max(...allLngs) + Math.min(...allLngs)) / 2;
    const spread = Math.max(
      Math.max(...allLats) - Math.min(...allLats),
      Math.max(...allLngs) - Math.min(...allLngs),
    );

    const zoom = Math.max(2, Math.min(
      spread < 1 ? 5 : spread < 5 ? 4 : spread < 15 ? 3 : 2,
      5,
    ));

    const result = { center: { lat: centerLat, lng: centerLng }, zoom, clusters: withSamples };
    previewCache = { data: result, ts: Date.now() };
    console.log(`[map-preview] Returning ${clusters.length} clusters, center (${centerLat.toFixed(2)}, ${centerLng.toFixed(2)}), zoom ${zoom}`);
    res.json(result);
  } catch (err) {
    console.error('map-preview error:', err);
    res.status(500).json({ error: 'Failed to generate map preview' });
  }
});

export default router;

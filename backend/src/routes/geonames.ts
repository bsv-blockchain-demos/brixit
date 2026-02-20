/**
 * GeoNames proxy route.
 * Migrated from: supabase/functions/get-geonames-username/index.ts
 *
 * Endpoints:
 *   GET /api/geonames              → returns { username } if no endpoint param
 *   GET /api/geonames?endpoint=X&params=Y → proxies to secure.geonames.org/X with decoded params
 */
import { Router } from 'express';
import { config } from '../config.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const username = config.geonamesUsername;
    if (!username) {
      res.status(500).json({
        error: 'Missing GeoNames username (set GEONAMES_USERNAME in .env)',
      });
      return;
    }

    const endpoint = req.query.endpoint as string | undefined;
    const paramsB64 = req.query.params as string | undefined;

    // If no endpoint param, just return the username
    if (!endpoint) {
      res.json({ username });
      return;
    }

    if (!paramsB64) {
      res.status(400).json({ error: 'Missing params' });
      return;
    }

    // Decode base64-encoded query params
    let decodedParams: string;
    try {
      decodedParams = Buffer.from(paramsB64, 'base64').toString('utf-8');
    } catch {
      res.status(400).json({ error: 'Invalid params encoding' });
      return;
    }

    // Build GeoNames URL
    const geonamesUrl = new URL(`https://secure.geonames.org/${endpoint}`);
    const search = new URLSearchParams(decodedParams);
    search.set('username', username);
    geonamesUrl.search = search.toString();

    // Proxy the request
    const geonamesRes = await fetch(geonamesUrl.toString());
    const bodyText = await geonamesRes.text();

    res
      .status(geonamesRes.status)
      .set('Content-Type', geonamesRes.headers.get('content-type') || 'application/json')
      .send(bodyText);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[geonames] Error:', message);
    res.status(500).json({ error: message });
  }
});

// GET /api/geonames/username — explicit endpoint for fetching just the username
router.get('/username', (_req, res) => {
  const username = config.geonamesUsername;
  if (!username) {
    res.status(500).json({ error: 'Missing GeoNames username (set GEONAMES_USERNAME in .env)' });
    return;
  }
  res.json({ username });
});

export default router;

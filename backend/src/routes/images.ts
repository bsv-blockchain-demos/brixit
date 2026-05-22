/**
 * POST /api/images  →  batch presigned GET URLs for submission image keys.
 * Public — submissions are public-facing so anyone browsing can fetch the URLs.
 * 1-hour TTL on the URLs; client refetches when they expire.
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getS3Client, getS3BucketName, isSubmissionImageKey } from '../lib/s3.js';

const router = Router();

const PRESIGNED_GET_TTL_SECONDS = 3600;
const MAX_KEYS_PER_REQUEST = 50;

router.post('/', async (req: Request, res: Response) => {
  try {
    const { keys } = req.body ?? {};

    if (!Array.isArray(keys) || keys.length === 0) {
      res.status(400).json({ error: 'keys must be a non-empty array' });
      return;
    }
    if (keys.length > MAX_KEYS_PER_REQUEST) {
      res.status(400).json({ error: `Too many keys (max ${MAX_KEYS_PER_REQUEST} per request)` });
      return;
    }
    for (const k of keys) {
      if (!isSubmissionImageKey(k)) {
        res.status(400).json({ error: 'All keys must be submission image keys' });
        return;
      }
    }

    const bucket = getS3BucketName();
    const client = getS3Client();
    const results = await Promise.all(
      (keys as string[]).map(async (key) => {
        const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
        const url = await getSignedUrl(client, cmd, { expiresIn: PRESIGNED_GET_TTL_SECONDS });
        return [key, url] as const;
      }),
    );

    const urls: Record<string, string> = {};
    for (const [k, u] of results) urls[k] = u;

    res.json({ urls, expiresIn: PRESIGNED_GET_TTL_SECONDS });
  } catch (err) {
    console.error('[images] Error:', err);
    res.status(500).json({ error: 'Failed to generate image URLs' });
  }
});

export default router;

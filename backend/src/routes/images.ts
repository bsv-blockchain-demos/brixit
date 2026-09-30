/**
 * POST /api/images  →  batch presigned GET URLs for submission image keys.
 *
 * Photos attached to a reading are private: only the submitter and admins may
 * resolve a key to a fetchable URL. This is the enforcement point — a presigned
 * URL is the only way to read the object, so gating here is what actually keeps
 * other users out, independent of what any client does with the key list.
 *
 * 1-hour TTL on the URLs; client refetches when they expire.
 */
import { Router } from 'express';
import type { Response } from 'express';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import prisma from '../db/client.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { getS3Client, getS3BucketName, isSubmissionImageKey, submissionIdFromKey } from '../lib/s3.js';

const router = Router();

const PRESIGNED_GET_TTL_SECONDS = 3600;
const MAX_KEYS_PER_REQUEST = 50;

router.post('/', requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
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

    // Every key must be shaped like one we issued and name a submission.
    const submissionIds = new Set<string>();
    for (const k of keys) {
      if (!isSubmissionImageKey(k)) {
        res.status(400).json({ error: 'All keys must be submission image keys' });
        return;
      }
      const submissionId = submissionIdFromKey(k);
      if (!submissionId) {
        res.status(400).json({ error: 'Could not derive submission id from key' });
        return;
      }
      submissionIds.add(submissionId);
    }

    // Admins see every reading's photos; everyone else only their own. An
    // all-or-nothing check keeps a batch from half-succeeding and leaking which
    // of the requested keys exist.
    const isAdmin = (req.user!.roles || []).includes('admin');
    if (!isAdmin) {
      const owned = await prisma.submission.findMany({
        where: { id: { in: [...submissionIds] }, userId: req.user!.sub },
        select: { id: true },
      });
      if (owned.length !== submissionIds.size) {
        res.status(403).json({ error: 'Not authorized to view these images' });
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

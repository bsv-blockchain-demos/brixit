/**
 * Submission image upload routes — S3-backed.
 *
 *   POST   /api/upload/presigned-url  (auth) → presigned PUT URL + S3 key for one file
 *   POST   /api/upload/finalize       (auth) → record S3 keys as submission_image rows
 *   DELETE /api/upload/delete         (auth) → remove an image from S3 + DB
 *
 * Flow: frontend gets a presigned URL per file, PUTs the file directly to S3,
 * then POSTs the collected keys to /finalize to attach them to a submission.
 */
import { Router } from 'express';
import type { Response } from 'express';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import prisma from '../db/client.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import {
  getS3Client,
  getS3BucketName,
  generateSubmissionImageKey,
  isSubmissionImageKey,
  submissionIdFromKey,
} from '../lib/s3.js';

const router = Router();

// Map of allowed filename extensions → expected MIME type.
// Used to verify the client's declared contentType matches the filename so a
// malicious caller can't spoof contentType to slip a non-image past S3.
const EXTENSION_TO_MIME: Record<string, string> = {
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  png:  'image/png',
  gif:  'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot + 1).toLowerCase();
}

const PRESIGNED_PUT_TTL_SECONDS = 300;     // 5 min — long enough for the upload, short enough to not linger
const MAX_KEYS_PER_FINALIZE = 10;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // matches MAX_FILE_SIZE_MB

// ─── POST /api/upload/presigned-url ─────────────────────────────────────────
router.post('/presigned-url', requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submission_id, filename, contentType, contentLength } = req.body ?? {};

    if (typeof submission_id !== 'string' || typeof filename !== 'string' || typeof contentType !== 'string') {
      res.status(400).json({ error: 'Missing required fields: submission_id, filename, contentType' });
      return;
    }
    const expectedMime = EXTENSION_TO_MIME[getExtension(filename)];
    if (!expectedMime || expectedMime !== contentType.toLowerCase()) {
      res.status(400).json({ error: 'File extension must be an image type and match contentType.' });
      return;
    }
    // Hard size cap baked into the signed URL — S3 rejects any PUT whose
    // Content-Length differs, so the client can't lie about size and slip a
    // huge file through.
    if (typeof contentLength !== 'number' || !Number.isFinite(contentLength) || contentLength <= 0 || contentLength > MAX_UPLOAD_BYTES) {
      res.status(400).json({ error: `contentLength must be 1..${MAX_UPLOAD_BYTES} bytes` });
      return;
    }

    // Verify caller owns the submission before issuing an upload URL.
    const submission = await prisma.submission.findUnique({
      where: { id: submission_id },
      select: { userId: true },
    });
    if (!submission) {
      res.status(404).json({ error: 'Submission not found' });
      return;
    }
    if (submission.userId !== req.user!.sub) {
      res.status(403).json({ error: 'Not authorized to upload to this submission' });
      return;
    }

    const key = generateSubmissionImageKey(submission_id, filename);
    const command = new PutObjectCommand({
      Bucket: getS3BucketName(),
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    });
    const uploadUrl = await getSignedUrl(getS3Client(), command, { expiresIn: PRESIGNED_PUT_TTL_SECONDS });

    res.json({ uploadUrl, key, expiresIn: PRESIGNED_PUT_TTL_SECONDS });
  } catch (err) {
    console.error('[upload/presigned-url] Error:', err);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
});

// ─── POST /api/upload/finalize ──────────────────────────────────────────────
router.post('/finalize', requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submission_id, keys } = req.body ?? {};

    if (typeof submission_id !== 'string' || !Array.isArray(keys) || keys.length === 0) {
      res.status(400).json({ error: 'submission_id and a non-empty keys[] are required' });
      return;
    }
    if (keys.length > MAX_KEYS_PER_FINALIZE) {
      res.status(400).json({ error: `Too many keys (max ${MAX_KEYS_PER_FINALIZE} per call)` });
      return;
    }
    // Every key must belong to this submission's key namespace.
    for (const k of keys) {
      if (!isSubmissionImageKey(k) || submissionIdFromKey(k) !== submission_id) {
        res.status(400).json({ error: `Key does not belong to submission ${submission_id}` });
        return;
      }
    }

    const submission = await prisma.submission.findUnique({
      where: { id: submission_id },
      select: { userId: true },
    });
    if (!submission) {
      res.status(404).json({ error: 'Submission not found' });
      return;
    }
    if (submission.userId !== req.user!.sub) {
      res.status(403).json({ error: 'Not authorized to attach images to this submission' });
      return;
    }

    const records = await Promise.all(
      (keys as string[]).map((key) =>
        prisma.submissionImage.create({
          data: { submissionId: submission_id, imageUrl: key },
        }),
      ),
    );
    res.json({ images: records.map((r) => ({ id: r.id, key: r.imageUrl })) });
  } catch (err) {
    console.error('[upload/finalize] Error:', err);
    res.status(500).json({ error: 'Failed to finalize upload' });
  }
});

// ─── DELETE /api/upload/delete ──────────────────────────────────────────────
router.delete('/delete', requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { key } = req.body ?? {};
    if (!isSubmissionImageKey(key)) {
      res.status(400).json({ error: 'Invalid or missing key' });
      return;
    }

    const submissionId = submissionIdFromKey(key);
    if (!submissionId) {
      res.status(400).json({ error: 'Could not derive submission id from key' });
      return;
    }

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      select: { userId: true },
    });
    if (!submission) {
      res.status(404).json({ error: 'Submission not found' });
      return;
    }
    if (submission.userId !== req.user!.sub && !(req.user!.roles || []).includes('admin')) {
      res.status(403).json({ error: 'Not authorized to delete this image' });
      return;
    }

    await getS3Client().send(new DeleteObjectCommand({
      Bucket: getS3BucketName(),
      Key: key,
    }));
    await prisma.submissionImage.deleteMany({ where: { imageUrl: key } });

    res.json({ success: true });
  } catch (err) {
    console.error('[upload/delete] Error:', err);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

export default router;

/**
 * AWS S3 client + key helpers for submission image storage.
 *
 * Required env vars:
 *   AWS_REGION
 *   AWS_ACCESS_KEY_ID
 *   AWS_SECRET_ACCESS_KEY
 *   AWS_S3_BUCKET
 */
import { S3Client } from '@aws-sdk/client-s3';

let s3Client: S3Client | null = null;

function getRequiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: getRequiredEnv('AWS_REGION'),
      credentials: {
        accessKeyId: getRequiredEnv('AWS_ACCESS_KEY_ID'),
        secretAccessKey: getRequiredEnv('AWS_SECRET_ACCESS_KEY'),
      },
      requestChecksumCalculation: 'WHEN_REQUIRED',
    });
  }
  return s3Client;
}

export function getS3BucketName(): string {
  return getRequiredEnv('AWS_S3_BUCKET');
}

/** Submission UUIDs are already random/unpredictable — no hashing needed. */
export const SUBMISSION_IMAGE_PREFIX = 'submission-images';

/**
 * Generates an S3 key for a submission image.
 * Format: submission-images/{submissionId}/{timestamp}-{sanitizedFilename}
 */
export function generateSubmissionImageKey(submissionId: string, filename: string): string {
  const ts = Date.now();
  const sanitized = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${SUBMISSION_IMAGE_PREFIX}/${submissionId}/${ts}-${sanitized}`;
}

/** True if the key is shaped like one we issued — used to gate delete + read endpoints. */
export function isSubmissionImageKey(key: unknown): key is string {
  return typeof key === 'string' && key.startsWith(`${SUBMISSION_IMAGE_PREFIX}/`);
}

/** Extracts the submissionId segment from a key. */
export function submissionIdFromKey(key: string): string | null {
  const match = key.match(new RegExp(`^${SUBMISSION_IMAGE_PREFIX}/([^/]+)/`));
  return match ? match[1] : null;
}

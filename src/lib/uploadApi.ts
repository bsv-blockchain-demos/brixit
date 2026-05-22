/**
 * Upload API client — presigned URL → direct S3 PUT → finalize.
 * Display side: batch presigned GET URLs from POST /api/images.
 */
import { apiPost } from './api';

export interface PresignedUploadResponse {
  uploadUrl: string;
  key: string;
  expiresIn: number;
}

export async function getPresignedUploadUrl(
  submissionId: string,
  filename: string,
  contentType: string,
  contentLength: number,
): Promise<PresignedUploadResponse> {
  return apiPost<PresignedUploadResponse>('/api/upload/presigned-url', {
    submission_id: submissionId,
    filename,
    contentType,
    contentLength,
  });
}

/** Uploads the file directly to S3 using the presigned URL. */
export async function uploadFileToS3(uploadUrl: string, file: File): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  });
  if (!res.ok) {
    throw new Error(`S3 upload failed: ${res.status} ${res.statusText}`);
  }
}

/** Records the uploaded keys as submission_image rows. */
export async function finalizeUpload(
  submissionId: string,
  keys: string[],
): Promise<{ images: { id: string; key: string }[] }> {
  return apiPost('/api/upload/finalize', { submission_id: submissionId, keys });
}

/** Batch presigned GET URLs for display. Public endpoint. */
export async function getImageUrls(keys: string[]): Promise<Record<string, string>> {
  if (keys.length === 0) return {};
  const result = await apiPost<{ urls: Record<string, string>; expiresIn: number }>(
    '/api/images',
    { keys },
    { skipAuth: true },
  );
  return result.urls;
}

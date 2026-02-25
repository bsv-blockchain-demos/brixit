/**
 * File upload route (authenticated).
 *
 * Endpoint:
 *   POST /api/upload → Upload submission image(s)
 *
 * Stores files locally in UPLOAD_DIR and creates submission_images DB records.
 */
import { Router } from 'express';
import type { Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from '../db/client.js';
import { config } from '../config.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// Ensure upload directory exists
const uploadDir = config.uploadDir;
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const ALLOWED_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|heic|heif)$/i;
const ALLOWED_MIMETYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const upload = multer({
  storage,
  limits: { fileSize: config.maxFileSizeMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const extOk = ALLOWED_EXTENSIONS.test(path.extname(file.originalname));
    const mimeOk = ALLOWED_MIMETYPES.has(file.mimetype);
    if (extOk && mimeOk) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// POST /api/upload
router.post(
  '/',
  requireAuth as any,
  upload.array('images', 10),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { submission_id } = req.body;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        res.status(400).json({ error: 'No files uploaded' });
        return;
      }

      if (!submission_id) {
        res.status(400).json({ error: 'submission_id is required' });
        return;
      }

      // Verify submission exists and belongs to user
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

      // Create DB records for each uploaded file
      const imageRecords = await Promise.all(
        files.map((file) =>
          prisma.submissionImage.create({
            data: {
              submissionId: submission_id,
              imageUrl: `/uploads/${file.filename}`,
            },
          })
        )
      );

      res.json({
        success: true,
        images: imageRecords.map((r) => ({
          id: r.id,
          url: r.imageUrl,
        })),
      });
    } catch (err) {
      console.error('[upload] Error:', err);
      res.status(500).json({ error: 'Upload failed' });
    }
  }
);

export default router;

/**
 * Submission data routes.
 *
 * Public endpoints (no auth):
 *   GET /api/submissions              → Paginated, filtered list (from public_submission_details view)
 *   GET /api/submissions/count        → Count with same filters
 *   GET /api/submissions/bounds       → Submissions within map bounds
 *   GET /api/submissions/:id          → Single submission detail
 *
 * Authenticated endpoints:
 *   GET /api/submissions/mine         → Current user's submissions (paginated)
 *   GET /api/submissions/mine/count   → Current user's submission count
 *   GET /api/submissions/mine/crops   → Distinct crop IDs for current user
 *   DELETE /api/submissions/:id       → Delete own submission
 *
 * POST /api/submissions is handled by autoVerifySubmission.ts
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../db/client.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// Prisma include for full submission detail (authenticated context)
const FULL_SUBMISSION_INCLUDE = {
  crop: { select: { id: true, name: true, label: true, poorBrix: true, averageBrix: true, goodBrix: true, excellentBrix: true, category: true } },
  brand: { select: { id: true, name: true, label: true } },
  location: { select: { id: true, name: true, label: true } },
  place: { select: { id: true, label: true, latitude: true, longitude: true, streetAddress: true, city: true, state: true, country: true } },
  user: { select: { id: true, displayName: true } },
  verifier: { select: { id: true, displayName: true } },
  images: { select: { imageUrl: true } },
} as const;

function formatFullSubmission(s: any) {
  return {
    id: s.id,
    assessment_date: s.assessmentDate,
    brix_value: Number(s.brixValue),
    verified: s.verified,
    verified_at: s.verifiedAt,
    crop_variety: s.cropVariety,
    outlier_notes: s.outlierNotes,
    purchase_date: s.purchaseDate,
    crop_id: s.crop?.id ?? null,
    crop_name: s.crop?.name ?? null,
    crop_label: s.crop?.label ?? null,
    poor_brix: s.crop?.poorBrix ? Number(s.crop.poorBrix) : null,
    average_brix: s.crop?.averageBrix ? Number(s.crop.averageBrix) : null,
    good_brix: s.crop?.goodBrix ? Number(s.crop.goodBrix) : null,
    excellent_brix: s.crop?.excellentBrix ? Number(s.crop.excellentBrix) : null,
    category: s.crop?.category ?? null,
    brand_id: s.brand?.id ?? null,
    brand_name: s.brand?.name ?? null,
    brand_label: s.brand?.label ?? null,
    location_id: s.location?.id ?? null,
    location_name: s.location?.name ?? null,
    location_label: s.location?.label ?? null,
    place_id: s.place?.id ?? null,
    place_label: s.place?.label ?? null,
    latitude: s.place?.latitude ?? null,
    longitude: s.place?.longitude ?? null,
    street_address: s.place?.streetAddress ?? null,
    city: s.place?.city ?? null,
    state: s.place?.state ?? null,
    country: s.place?.country ?? null,
    user_id: s.user?.id ?? null,
    user_display_name: s.user?.displayName ?? null,
    verified_by_display_name: s.verifier?.displayName ?? null,
    images: s.images?.map((i: any) => i.imageUrl) ?? [],
  };
}

// --- Public: GET /api/submissions (paginated, filtered via public_submission_details view) ---
router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 50, 200));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const sortBy = (req.query.sortBy as string) || 'assessment_date';
    const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';

    // Build where clause from query params
    const where: any = { verified: true };

    if (req.query.cropTypes) {
      const cropNames = (req.query.cropTypes as string).split(',');
      where.crop = { name: { in: cropNames } };
    }
    if (req.query.category) {
      where.crop = { ...where.crop, category: req.query.category as string };
    }
    if (req.query.city) {
      where.place = { ...where.place, city: { equals: req.query.city as string, mode: 'insensitive' } };
    }
    if (req.query.state) {
      where.place = { ...where.place, state: { equals: req.query.state as string, mode: 'insensitive' } };
    }
    if (req.query.country) {
      where.place = { ...where.place, country: { equals: req.query.country as string, mode: 'insensitive' } };
    }
    if (req.query.brixMin) {
      where.brixValue = { ...where.brixValue, gte: Number(req.query.brixMin) };
    }
    if (req.query.brixMax) {
      where.brixValue = { ...where.brixValue, lte: Number(req.query.brixMax) };
    }
    if (req.query.dateStart) {
      where.assessmentDate = { ...where.assessmentDate, gte: new Date(req.query.dateStart as string) };
    }
    if (req.query.dateEnd) {
      where.assessmentDate = { ...where.assessmentDate, lte: new Date(req.query.dateEnd as string) };
    }
    if (req.query.search) {
      const s = (req.query.search as string).trim();
      where.OR = [
        { crop: { name: { contains: s, mode: 'insensitive' } } },
        { crop: { label: { contains: s, mode: 'insensitive' } } },
        { brand: { name: { contains: s, mode: 'insensitive' } } },
        { brand: { label: { contains: s, mode: 'insensitive' } } },
        { place: { label: { contains: s, mode: 'insensitive' } } },
        { location: { name: { contains: s, mode: 'insensitive' } } },
        { location: { label: { contains: s, mode: 'insensitive' } } },
        { outlierNotes: { contains: s, mode: 'insensitive' } },
      ];
    }

    // Map sortBy to Prisma orderBy
    const orderByMap: Record<string, any> = {
      assessment_date: { assessmentDate: sortOrder },
      brix_value: { brixValue: sortOrder },
      crop_name: { crop: { name: sortOrder } },
      place_label: { place: { label: sortOrder } },
    };

    const submissions = await prisma.submission.findMany({
      where,
      include: {
        crop: { select: { id: true, name: true, label: true, poorBrix: true, averageBrix: true, goodBrix: true, excellentBrix: true, category: true } },
        brand: { select: { id: true, name: true, label: true } },
        location: { select: { id: true, name: true, label: true } },
        place: { select: { id: true, label: true, latitude: true, longitude: true, streetAddress: true, city: true, state: true, country: true } },
      },
      orderBy: orderByMap[sortBy] || { assessmentDate: 'desc' },
      skip: offset,
      take: limit,
    });

    // Public view: strip user PII
    const result = submissions.map((s: any) => ({
      id: s.id,
      assessment_date: s.assessmentDate,
      brix_value: Number(s.brixValue),
      verified: s.verified,
      verified_at: s.verifiedAt,
      crop_variety: s.cropVariety,
      outlier_notes: s.outlierNotes,
      purchase_date: s.purchaseDate,
      crop_id: s.crop?.id ?? null,
      crop_name: s.crop?.name ?? null,
      crop_label: s.crop?.label ?? null,
      poor_brix: s.crop?.poorBrix ? Number(s.crop.poorBrix) : null,
      average_brix: s.crop?.averageBrix ? Number(s.crop.averageBrix) : null,
      good_brix: s.crop?.goodBrix ? Number(s.crop.goodBrix) : null,
      excellent_brix: s.crop?.excellentBrix ? Number(s.crop.excellentBrix) : null,
      category: s.crop?.category ?? null,
      brand_id: s.brand?.id ?? null,
      brand_name: s.brand?.name ?? null,
      brand_label: s.brand?.label ?? null,
      location_id: s.location?.id ?? null,
      location_name: s.location?.name ?? null,
      location_label: s.location?.label ?? null,
      place_id: s.place?.id ?? null,
      place_label: s.place?.label ?? null,
      latitude: s.place?.latitude ?? null,
      longitude: s.place?.longitude ?? null,
      street_address: s.place?.streetAddress ?? null,
      city: s.place?.city ?? null,
      state: s.place?.state ?? null,
      country: s.place?.country ?? null,
    }));

    res.json(result);
  } catch (err) {
    console.error('[submissions] Error:', err);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// --- Public: GET /api/submissions/count ---
router.get('/count', async (req: Request, res: Response) => {
  try {
    const where: any = { verified: true };

    if (req.query.cropTypes) {
      where.crop = { name: { in: (req.query.cropTypes as string).split(',') } };
    }
    if (req.query.category) {
      where.crop = { ...where.crop, category: req.query.category as string };
    }
    if (req.query.city) {
      where.place = { ...where.place, city: { equals: req.query.city as string, mode: 'insensitive' } };
    }
    if (req.query.state) {
      where.place = { ...where.place, state: { equals: req.query.state as string, mode: 'insensitive' } };
    }
    if (req.query.country) {
      where.place = { ...where.place, country: { equals: req.query.country as string, mode: 'insensitive' } };
    }
    if (req.query.brixMin) {
      where.brixValue = { ...where.brixValue, gte: Number(req.query.brixMin) };
    }
    if (req.query.brixMax) {
      where.brixValue = { ...where.brixValue, lte: Number(req.query.brixMax) };
    }

    const count = await prisma.submission.count({ where });
    res.json({ count });
  } catch (err) {
    console.error('[submissions/count] Error:', err);
    res.status(500).json({ error: 'Failed to count submissions' });
  }
});

// --- Public: GET /api/submissions/bounds ---
router.get('/bounds', async (req: Request, res: Response) => {
  try {
    const west = Number(req.query.west);
    const south = Number(req.query.south);
    const east = Number(req.query.east);
    const north = Number(req.query.north);
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 500, 2000));
    const sortOrder = req.query.sortOrder === 'asc' ? 'asc' as const : 'desc' as const;

    if ([west, south, east, north].some(isNaN)) {
      res.status(400).json({ error: 'west, south, east, north are required numeric params' });
      return;
    }

    const submissions = await prisma.submission.findMany({
      where: {
        verified: true,
        place: {
          latitude: { not: null, gte: south, lte: north },
          longitude: { not: null, gte: west, lte: east },
        },
      },
      include: {
        crop: { select: { id: true, name: true, label: true, poorBrix: true, averageBrix: true, goodBrix: true, excellentBrix: true, category: true } },
        brand: { select: { id: true, name: true, label: true } },
        location: { select: { id: true, name: true, label: true } },
        place: { select: { id: true, label: true, latitude: true, longitude: true, streetAddress: true, city: true, state: true, country: true } },
      },
      orderBy: { assessmentDate: sortOrder },
      take: limit,
    });

    const result = submissions.map((s: any) => ({
      id: s.id,
      assessment_date: s.assessmentDate,
      brix_value: Number(s.brixValue),
      verified: s.verified,
      crop_variety: s.cropVariety,
      crop_id: s.crop?.id ?? null,
      crop_name: s.crop?.name ?? null,
      crop_label: s.crop?.label ?? null,
      poor_brix: s.crop?.poorBrix ? Number(s.crop.poorBrix) : null,
      average_brix: s.crop?.averageBrix ? Number(s.crop.averageBrix) : null,
      good_brix: s.crop?.goodBrix ? Number(s.crop.goodBrix) : null,
      excellent_brix: s.crop?.excellentBrix ? Number(s.crop.excellentBrix) : null,
      category: s.crop?.category ?? null,
      brand_id: s.brand?.id ?? null,
      brand_name: s.brand?.name ?? null,
      brand_label: s.brand?.label ?? null,
      location_id: s.location?.id ?? null,
      location_name: s.location?.name ?? null,
      location_label: s.location?.label ?? null,
      place_id: s.place?.id ?? null,
      place_label: s.place?.label ?? null,
      latitude: s.place?.latitude ?? null,
      longitude: s.place?.longitude ?? null,
      street_address: s.place?.streetAddress ?? null,
      city: s.place?.city ?? null,
      state: s.place?.state ?? null,
      country: s.place?.country ?? null,
    }));

    res.json(result);
  } catch (err) {
    console.error('[submissions/bounds] Error:', err);
    res.status(500).json({ error: 'Failed to fetch submissions in bounds' });
  }
});

// --- Authenticated: GET /api/submissions/mine ---
router.get('/mine', requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.sub;
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 50, 200));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const sortBy = (req.query.sortBy as string) || 'assessment_date';
    const sortOrder = req.query.sortOrder === 'asc' ? 'asc' as const : 'desc' as const;

    const orderByMap: Record<string, any> = {
      assessment_date: { assessmentDate: sortOrder },
      brix_value: { brixValue: sortOrder },
    };

    const submissions = await prisma.submission.findMany({
      where: { userId },
      include: FULL_SUBMISSION_INCLUDE,
      orderBy: orderByMap[sortBy] || { assessmentDate: 'desc' },
      skip: offset,
      take: limit,
    });

    res.json(submissions.map(formatFullSubmission));
  } catch (err) {
    console.error('[submissions/mine] Error:', err);
    res.status(500).json({ error: 'Failed to fetch your submissions' });
  }
});

// --- Authenticated: GET /api/submissions/mine/count ---
router.get('/mine/count', requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.sub;
    const where: any = { userId };
    if (req.query.verified !== undefined) {
      where.verified = req.query.verified === 'true';
    }
    const count = await prisma.submission.count({ where });
    res.json({ count });
  } catch (err) {
    console.error('[submissions/mine/count] Error:', err);
    res.status(500).json({ error: 'Failed to count your submissions' });
  }
});

// --- Authenticated: GET /api/submissions/mine/crops ---
router.get('/mine/crops', requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.sub;
    const submissions = await prisma.submission.findMany({
      where: { userId },
      select: { cropId: true },
      distinct: ['cropId'],
    });
    res.json(submissions.map((s: { cropId: string }) => s.cropId));
  } catch (err) {
    console.error('[submissions/mine/crops] Error:', err);
    res.status(500).json({ error: 'Failed to fetch your crop IDs' });
  }
});

// --- Public: GET /api/submissions/:id ---
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const submission = await prisma.submission.findUnique({
      where: { id: req.params.id },
      include: FULL_SUBMISSION_INCLUDE,
    });

    if (!submission) {
      res.status(404).json({ error: 'Submission not found' });
      return;
    }

    res.json(formatFullSubmission(submission));
  } catch (err) {
    console.error('[submissions/:id] Error:', err);
    res.status(500).json({ error: 'Failed to fetch submission' });
  }
});

// --- Authenticated: PUT /api/submissions/:id ---
router.put('/:id', requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.sub;
    const roles = req.user!.roles || [];

    const submission = await prisma.submission.findUnique({
      where: { id: req.params.id },
      select: { userId: true, verified: true },
    });

    if (!submission) {
      res.status(404).json({ error: 'Submission not found' });
      return;
    }

    // Only owner or admin can update
    const isAdmin = roles.includes('admin');
    if (submission.userId !== userId && !isAdmin) {
      res.status(403).json({ error: 'Not authorized to update this submission' });
      return;
    }

    // Build Prisma update data from request body
    const body = req.body;
    const data: any = {};

    if (body.brix_value !== undefined) data.brixValue = body.brix_value;
    if (body.crop_variety !== undefined) data.cropVariety = body.crop_variety;
    if (body.assessment_date !== undefined) data.assessmentDate = new Date(body.assessment_date);
    if (body.purchase_date !== undefined) data.purchaseDate = body.purchase_date ? new Date(body.purchase_date) : null;
    if (body.outlier_notes !== undefined) data.outlierNotes = body.outlier_notes;
    if (body.crop_id !== undefined) data.cropId = body.crop_id;
    if (body.brand_id !== undefined) data.brandId = body.brand_id;
    if (body.location_id !== undefined) data.locationId = body.location_id;

    // Only admin can update verification status
    if (isAdmin) {
      if (body.verified !== undefined) data.verified = body.verified;
      if (body.verified_by !== undefined) data.verifiedBy = body.verified_by;
      if (body.verified_at !== undefined) data.verifiedAt = body.verified_at ? new Date(body.verified_at) : null;
    }

    const updated = await prisma.submission.update({
      where: { id: req.params.id },
      data,
      include: FULL_SUBMISSION_INCLUDE,
    });

    res.json(formatFullSubmission(updated));
  } catch (err) {
    console.error('[submissions/:id PUT] Error:', err);
    res.status(500).json({ error: 'Failed to update submission' });
  }
});

// --- Authenticated: DELETE /api/submissions/:id ---
router.delete('/:id', requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.sub;
    const roles = req.user!.roles || [];

    const submission = await prisma.submission.findUnique({
      where: { id: req.params.id },
      select: { userId: true },
    });

    if (!submission) {
      res.status(404).json({ error: 'Submission not found' });
      return;
    }

    // Only owner or admin can delete
    if (submission.userId !== userId && !roles.includes('admin')) {
      res.status(403).json({ error: 'Not authorized to delete this submission' });
      return;
    }

    // Delete images first (cascade should handle this, but be explicit)
    await prisma.submissionImage.deleteMany({ where: { submissionId: req.params.id } });
    await prisma.submission.delete({ where: { id: req.params.id } });

    // Decrement user stats
    if (submission.userId) {
      await prisma.user.update({
        where: { id: submission.userId },
        data: {
          submissionCount: { decrement: 1 },
        },
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[submissions/:id DELETE] Error:', err);
    res.status(500).json({ error: 'Failed to delete submission' });
  }
});

export default router;

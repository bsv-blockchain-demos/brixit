/**
 * Admin routes (requires admin role).
 *
 * Endpoints:
 *   GET  /api/admin/users                        → List all users with roles
 *   GET  /api/admin/users/:id                    → User detail + recent submissions
 *   GET  /api/admin/submissions                  → All submissions (search/filter)
 *   GET  /api/admin/submissions/unverified        → List unverified submissions
 *   POST /api/admin/roles/grant                   → Grant role to user
 *   POST /api/admin/roles/revoke                  → Revoke role from user
 *   POST /api/admin/submissions/:id/verify        → Verify/unverify a submission
 *   DELETE /api/admin/submissions/:id             → Delete a submission
 */
import { Router } from 'express';
import type { Response } from 'express';
import prisma from '../db/client.js';
import { requireAuth, requireAdmin, type AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// All admin routes require auth + admin role
router.use(requireAuth as any, requireAdmin as any);

// GET /api/admin/users?search=&limit=20&offset=0
router.get('/users', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 20, 100));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const search = (req.query.search as string | undefined)?.trim() || undefined;

    const where = search
      ? {
          OR: [
            { displayName: { contains: search, mode: 'insensitive' as const } },
            { id: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : undefined;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: { roles: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.user.count({ where }),
    ]);

    const data = users.map((u: any) => ({
      id: u.id,
      display_name: u.displayName,
      country: u.country,
      state: u.state,
      city: u.city,
      points: u.points,
      submission_count: u.submissionCount,
      created_at: u.createdAt,
      roles: u.roles.map((r: any) => r.role),
    }));

    res.json({ data, total });
  } catch (err) {
    console.error('[admin/users] Error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/admin/users/:id
router.get('/users/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.params.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: true,
        submissions: {
          include: {
            crop: { select: { name: true, label: true, poorBrix: true, excellentBrix: true } },
            brand: { select: { name: true, label: true } },
            place: { select: { label: true, city: true, state: true } },
          },
          orderBy: { assessmentDate: 'desc' },
          take: 50,
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      id: user.id,
      display_name: (user as any).displayName,
      country: (user as any).country,
      state: (user as any).state,
      city: (user as any).city,
      points: (user as any).points,
      submission_count: (user as any).submissionCount,
      created_at: (user as any).createdAt,
      roles: (user as any).roles.map((r: any) => r.role),
      submissions: (user as any).submissions.map((s: any) => ({
        id: s.id,
        assessment_date: s.assessmentDate,
        brix_value: Number(s.brixValue),
        verified: s.verified,
        crop_name: s.crop?.name ?? null,
        crop_label: s.crop?.label ?? null,
        poor_brix: s.crop?.poorBrix ? Number(s.crop.poorBrix) : null,
        excellent_brix: s.crop?.excellentBrix ? Number(s.crop.excellentBrix) : null,
        brand_name: s.brand?.name ?? null,
        brand_label: s.brand?.label ?? null,
        place_label: s.place?.label ?? null,
        place_city: s.place?.city ?? null,
        place_state: s.place?.state ?? null,
      })),
    });
  } catch (err) {
    console.error('[admin/users/:id] Error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// GET /api/admin/submissions?search=&limit=20&offset=0&verified=true|false
router.get('/submissions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 20, 100));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const search = (req.query.search as string | undefined)?.trim() || undefined;
    const verifiedParam = req.query.verified as string | undefined;
    const verifiedFilter = verifiedParam === 'true' ? true : verifiedParam === 'false' ? false : undefined;

    const where: any = {};
    if (verifiedFilter !== undefined) where.verified = verifiedFilter;
    if (search) {
      where.OR = [
        { crop: { name: { contains: search, mode: 'insensitive' } } },
        { crop: { label: { contains: search, mode: 'insensitive' } } },
        { place: { label: { contains: search, mode: 'insensitive' } } },
        { brand: { name: { contains: search, mode: 'insensitive' } } },
        { user: { displayName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [submissions, total] = await Promise.all([
      prisma.submission.findMany({
        where,
        include: {
          crop: { select: { name: true, label: true } },
          brand: { select: { name: true, label: true } },
          place: { select: { label: true, city: true, state: true } },
          user: { select: { id: true, displayName: true } },
        },
        orderBy: { assessmentDate: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.submission.count({ where }),
    ]);

    const data = submissions.map((s: any) => ({
      id: s.id,
      assessment_date: s.assessmentDate,
      brix_value: Number(s.brixValue),
      verified: s.verified,
      crop_name: s.crop?.name ?? null,
      crop_label: s.crop?.label ?? null,
      brand_name: s.brand?.name ?? null,
      brand_label: s.brand?.label ?? null,
      place_label: s.place?.label ?? null,
      place_city: s.place?.city ?? null,
      place_state: s.place?.state ?? null,
      user_display_name: s.user?.displayName ?? null,
      user_id: s.user?.id ?? null,
    }));

    res.json({ data, total });
  } catch (err) {
    console.error('[admin/submissions] Error:', err);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// GET /api/admin/submissions/unverified?limit=20&offset=0
router.get('/submissions/unverified', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 20, 100));
    const offset = Math.max(0, Number(req.query.offset) || 0);

    const where = { verified: false };

    const [submissions, total] = await Promise.all([
      prisma.submission.findMany({
        where,
        include: {
          crop: { select: { name: true, label: true } },
          brand: { select: { name: true, label: true } },
          place: { select: { label: true, city: true, state: true } },
          user: { select: { id: true, displayName: true } },
        },
        orderBy: { assessmentDate: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.submission.count({ where }),
    ]);

    const data = submissions.map((s: any) => ({
      id: s.id,
      assessment_date: s.assessmentDate,
      brix_value: Number(s.brixValue),
      crop_name: s.crop?.name ?? null,
      crop_label: s.crop?.label ?? null,
      brand_name: s.brand?.name ?? null,
      brand_label: s.brand?.label ?? null,
      place_label: s.place?.label ?? null,
      place_city: s.place?.city ?? null,
      place_state: s.place?.state ?? null,
      user_display_name: s.user?.displayName ?? null,
      user_id: s.user?.id ?? null,
    }));

    res.json({ data, total });
  } catch (err) {
    console.error('[admin/submissions/unverified] Error:', err);
    res.status(500).json({ error: 'Failed to fetch unverified submissions' });
  }
});

// POST /api/admin/roles/grant
router.post('/roles/grant', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { target_user_id, role_to_grant } = req.body;

    if (!target_user_id || !role_to_grant) {
      res.status(400).json({ success: false, error: 'target_user_id and role_to_grant are required' });
      return;
    }

    if (!['admin', 'contributor', 'viewer'].includes(role_to_grant)) {
      res.status(400).json({ success: false, error: 'Invalid role' });
      return;
    }

    // Upsert: create if not exists, ignore if already exists
    await prisma.userRole.upsert({
      where: { userId_role: { userId: target_user_id, role: role_to_grant } },
      update: {},
      create: { userId: target_user_id, role: role_to_grant },
    });

    res.json({ success: true, message: `Role '${role_to_grant}' granted` });
  } catch (err) {
    console.error('[admin/roles/grant] Error:', err);
    res.status(500).json({ success: false, error: 'Failed to grant role' });
  }
});

// POST /api/admin/roles/revoke
router.post('/roles/revoke', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { target_user_id, role_to_revoke } = req.body;

    if (!target_user_id || !role_to_revoke) {
      res.status(400).json({ success: false, error: 'target_user_id and role_to_revoke are required' });
      return;
    }

    await prisma.userRole.deleteMany({
      where: { userId: target_user_id, role: role_to_revoke },
    });

    res.json({ success: true, message: `Role '${role_to_revoke}' revoked` });
  } catch (err) {
    console.error('[admin/roles/revoke] Error:', err);
    res.status(500).json({ success: false, error: 'Failed to revoke role' });
  }
});

// POST /api/admin/submissions/:id/verify
router.post('/submissions/:id/verify', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const submissionId = req.params.id;
    const verify = req.body.verify !== false; // default true
    const adminUserId = req.user!.sub;

    await prisma.$transaction(async (tx) => {
      const submission = await tx.submission.findUnique({
        where: { id: submissionId },
      });
      if (!submission) {
        throw Object.assign(new Error('Submission not found'), { statusCode: 404 });
      }

      await tx.submission.update({
        where: { id: submissionId },
        data: {
          verified: verify,
          verifiedBy: verify ? adminUserId : null,
          verifiedAt: verify ? new Date() : null,
        },
      });

    });

    res.json({ success: true, message: verify ? 'Submission verified' : 'Submission unverified' });
  } catch (err: any) {
    if (err?.statusCode === 404) {
      res.status(404).json({ success: false, error: 'Submission not found' });
      return;
    }
    console.error('[admin/submissions/verify] Error:', err);
    res.status(500).json({ success: false, error: 'Failed to verify submission' });
  }
});

// DELETE /api/admin/submissions/:id
router.delete('/submissions/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const submissionId = req.params.id;

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      select: { userId: true },
    });

    if (!submission) {
      res.status(404).json({ success: false, error: 'Submission not found' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.submissionImage.deleteMany({ where: { submissionId } });
      await tx.submission.delete({ where: { id: submissionId } });

      if (submission.userId) {
        await tx.user.update({
          where: { id: submission.userId },
          data: { submissionCount: { decrement: 1 } },
        });
      }

    });

    res.json({ success: true, message: 'Submission deleted' });
  } catch (err) {
    console.error('[admin/submissions/delete] Error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete submission' });
  }
});

export default router;

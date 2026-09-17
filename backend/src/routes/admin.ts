/**
 * Admin routes (requires admin role).
 *
 * Endpoints:
 *   GET  /api/admin/users                        → List all users with roles
 *   GET  /api/admin/users/:id                    → User detail + recent submissions
 *   GET  /api/admin/submissions                  → All submissions (search/filter)
 *   GET  /api/admin/submissions/unverified        → List unverified submissions
 *   GET  /api/admin/engagement                   → Weekly new users + new measurements
 *   GET  /api/admin/engagement/summary           → Rolling windows, geography, categories
 *   POST /api/admin/roles/grant                   → Grant role to user
 *   POST /api/admin/roles/revoke                  → Revoke role from user
 *   POST /api/admin/submissions/:id/verify        → Verify/unverify a submission
 *   DELETE /api/admin/submissions/:id             → Delete a submission
 */
import { Router } from 'express';
import type { Response } from 'express';
import prisma from '../db/client.js';
import { requireAuth, requireAdmin, type AuthenticatedRequest } from '../middleware/auth.js';
import { requireAuthProof } from '../middleware/requireAuthProof.js';
import { AUTH_ACTIONS } from '../lib/authActions.js';
import { submissionHash } from '../lib/submissionHash.js';
import { validateRejectionMessage } from '../lib/rejectionMessage.js';
import {
  parseRange,
  DEFAULT_WEEKS,
  normalizeEngagementRows,
  normalizeWindowRows,
  splitGeoRows,
  normalizeCategoryRows,
} from '../lib/engagement.js';

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
        include: { roles: true, walletIdentity: { select: { identityKey: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.user.count({ where }),
    ]);

    const data = users.map((u: any) => ({
      id: u.id,
      display_name: u.displayName,
      identity_key: u.walletIdentity?.identityKey ?? null,
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
        walletIdentity: { select: { identityKey: true } },
        submissions: {
          include: {
            crop: { select: { name: true, label: true, poorBrix: true, excellentBrix: true } },
            brand: { select: { name: true, label: true } },
            venue: { select: { name: true, city: true, state: true } },
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
      identity_key: (user as any).walletIdentity?.identityKey ?? null,
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
        place_label: s.venue?.name ?? null,
        place_street_address: s.venue?.streetAddress ?? null,
        place_city: s.venue?.city ?? null,
        place_state: s.venue?.state ?? null,
        timestamped: !!s.outpoint,
        rejected: !!s.rejectedAt,
        anchor_failed: !!s.anchorFailedAt,
        rejection_message: s.rejectionMessage ?? null,
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
    const rejectedParam = req.query.rejected as string | undefined;

    const where: any = {};
    if (verifiedFilter !== undefined) where.verified = verifiedFilter;
    // rejected=true → only rejected; rejected=false → only non-rejected; omitted → all.
    if (rejectedParam === 'true') where.rejectedAt = { not: null };
    else if (rejectedParam === 'false') where.rejectedAt = null;
    if (search) {
      where.OR = [
        { crop: { name: { contains: search, mode: 'insensitive' } } },
        { crop: { label: { contains: search, mode: 'insensitive' } } },
        { venue: { name: { contains: search, mode: 'insensitive' } } },
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
          venue: { select: { name: true, streetAddress: true, city: true, state: true } },
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
      place_label: s.venue?.name ?? null,
      place_street_address: s.venue?.streetAddress ?? null,
      place_city: s.venue?.city ?? null,
      place_state: s.venue?.state ?? null,
      user_display_name: s.user?.displayName ?? null,
      user_id: s.user?.id ?? null,
      timestamped: !!s.outpoint,
      rejected: !!s.rejectedAt,
      anchor_failed: !!s.anchorFailedAt,
      rejection_message: s.rejectionMessage ?? null,
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

    // Pending = awaiting a decision: not yet verified and not rejected.
    const where = { verified: false, rejectedAt: null };

    const [submissions, total] = await Promise.all([
      prisma.submission.findMany({
        where,
        include: {
          crop: { select: { name: true, label: true } },
          brand: { select: { name: true, label: true } },
          venue: { select: { name: true, streetAddress: true, city: true, state: true } },
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
      place_label: s.venue?.name ?? null,
      place_street_address: s.venue?.streetAddress ?? null,
      place_city: s.venue?.city ?? null,
      place_state: s.venue?.state ?? null,
      user_display_name: s.user?.displayName ?? null,
      user_id: s.user?.id ?? null,
      timestamped: !!s.outpoint,
      rejected: !!s.rejectedAt,
      anchor_failed: !!s.anchorFailedAt,
      rejection_message: s.rejectionMessage ?? null,
    }));

    res.json({ data, total });
  } catch (err) {
    console.error('[admin/submissions/unverified] Error:', err);
    res.status(500).json({ error: 'Failed to fetch unverified submissions' });
  }
});

// GET /api/admin/engagement?weeks=12
// Read-only: the router-level requireAuth + requireAdmin is the whole gate.
router.get('/engagement', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const range = parseRange(req.query.weeks);
    // "All" resolves to a real week count here so the series query below stays
    // as it was. Capped so a long-lived deployment can't render 1000 bars.
    const weeks = range.all
      ? Number(
          (
            await prisma.$queryRaw<Array<{ weeks: number }>>`
              SELECT GREATEST(1, LEAST(104, ceil(
                extract(epoch FROM now() - LEAST(
                  COALESCE((SELECT min(created_at) FROM users), now()),
                  COALESCE((SELECT min(created_at) FROM submissions), now())
                )) / 604800.0
              )::int + 1))::int AS weeks
            `
          )[0]?.weeks ?? DEFAULT_WEEKS,
        )
      : range.weeks;

    // Weeks are generated, not derived from the rows, so empty weeks come back
    // as zeroes. ISO weeks in the session timezone; both counts key off
    // created_at, since assessment_date is backdatable.
    const rows = await prisma.$queryRaw<unknown[]>`
      WITH bounds AS (
        SELECT
          date_trunc('week', CURRENT_TIMESTAMP) AS current_week,
          date_trunc('week', CURRENT_TIMESTAMP) - make_interval(weeks => ${weeks}::int - 1) AS first_week
      ),
      weeks AS (
        SELECT generate_series(
          (SELECT first_week FROM bounds),
          (SELECT current_week FROM bounds),
          interval '1 week'
        ) AS week_start
      ),
      user_counts AS (
        SELECT date_trunc('week', created_at) AS week_start, count(*) AS n
        FROM users
        WHERE created_at >= (SELECT first_week FROM bounds)
        GROUP BY 1
      ),
      submission_counts AS (
        SELECT date_trunc('week', created_at) AS week_start, count(*) AS n
        FROM submissions
        WHERE created_at >= (SELECT first_week FROM bounds)
        GROUP BY 1
      )
      SELECT
        w.week_start,
        COALESCE(uc.n, 0) AS new_users,
        COALESCE(sc.n, 0) AS new_measurements
      FROM weeks w
      LEFT JOIN user_counts uc ON uc.week_start = w.week_start
      LEFT JOIN submission_counts sc ON sc.week_start = w.week_start
      ORDER BY w.week_start
    `;

    res.json({ weeks: normalizeEngagementRows(rows) });
  } catch (err) {
    console.error('[admin/engagement] Error:', err);
    res.status(500).json({ error: 'Failed to fetch engagement stats' });
  }
});

// GET /api/admin/engagement/summary
// Rolling 7/30/90-day windows plus all-time geography and category breakdowns.
// Counts every submission, verified or not — unlike the public leaderboard,
// which shows only verified readings, so the totals here read higher.
router.get('/engagement/summary', async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Null means no time gate. The rolling windows below ignore it by design —
    // their whole point is comparing fixed periods against each other.
    //
    // Rejected submissions are counted deliberately: a declined reading is still
    // a person using the app, and resubmission exists for exactly that case.
    const range = parseRange(req.query.weeks);
    const gate: number | null = range.all ? null : range.weeks;

    const [windowRows, geoRows, categoryRows] = await Promise.all([
      // A contributor is "repeat" on distinct active days, not raw count: five
      // readings entered in one sitting is one visit, not five.
      prisma.$queryRaw<unknown[]>`
        -- NULL is the all-time span: no lower bound, and the only column the
        -- created_at backfill cannot distort. Sorts last under ASC NULLS LAST.
        WITH spans AS (SELECT days FROM (VALUES (7), (30), (90), (NULL::int)) AS v(days))
        SELECT
          sp.days,
          u.new_users,
          u.converted,
          c.unique_contributors,
          c.repeat_contributors,
          c.median_readings
        FROM spans sp
        CROSS JOIN LATERAL (
          SELECT
            count(*) AS new_users,
            count(*) FILTER (
              WHERE EXISTS (SELECT 1 FROM submissions s WHERE s.user_id = us.id)
            ) AS converted
          FROM users us
          WHERE (sp.days IS NULL OR us.created_at >= now() - make_interval(days => sp.days))
        ) u
        CROSS JOIN LATERAL (
          SELECT
            count(*) AS unique_contributors,
            count(*) FILTER (WHERE per_user.active_days > 1) AS repeat_contributors,
            COALESCE(
              round(percentile_cont(0.5) WITHIN GROUP (ORDER BY per_user.readings::double precision)::numeric, 2),
              0
            ) AS median_readings
          FROM (
            SELECT
              s.user_id,
              count(*) AS readings,
              count(DISTINCT date_trunc('day', s.created_at AT TIME ZONE 'UTC')) AS active_days
            FROM submissions s
            WHERE s.user_id IS NOT NULL
              AND (sp.days IS NULL OR s.created_at >= now() - make_interval(days => sp.days))
            GROUP BY s.user_id
          ) per_user
        ) c
        ORDER BY sp.days
      `,

      // Two different questions: where readings were taken, and where the people
      // who take them live. Neither substitutes for the other.
      prisma.$queryRaw<unknown[]>`
        WITH geo AS (
          SELECT
            'reading' AS basis,
            COALESCE(NULLIF(btrim(v.country), ''), 'Unknown') AS country,
            COALESCE(NULLIF(btrim(v.state), ''), 'Unknown') AS state,
            count(*) AS n
          FROM submissions s
          JOIN venues v ON v.id = s.venue_id
          WHERE (${gate}::int IS NULL OR s.created_at >= date_trunc('week', CURRENT_TIMESTAMP)
               - make_interval(weeks => ${gate}::int - 1))
          GROUP BY 1, 2, 3
          UNION ALL
          SELECT
            'contributor',
            COALESCE(NULLIF(btrim(u.country), ''), 'Unknown'),
            COALESCE(NULLIF(btrim(u.state), ''), 'Unknown'),
            count(*)
          FROM users u
          WHERE EXISTS (SELECT 1 FROM submissions cs WHERE cs.user_id = u.id)
          GROUP BY 1, 2, 3
        )
        SELECT basis, country, state, n
        FROM (
          SELECT geo.*, row_number() OVER (PARTITION BY basis ORDER BY n DESC, country, state) AS rn
          FROM geo
        ) ranked
        WHERE rn <= 25
        ORDER BY basis, n DESC, country, state
      `,

      prisma.$queryRaw<unknown[]>`
        SELECT
          COALESCE(NULLIF(btrim(c.category), ''), 'Uncategorised') AS category,
          count(*) AS readings
        FROM submissions s
        JOIN crops c ON c.id = s.crop_id
        WHERE (${gate}::int IS NULL OR s.created_at >= date_trunc('week', CURRENT_TIMESTAMP)
               - make_interval(weeks => ${gate}::int - 1))
        GROUP BY 1
        ORDER BY readings DESC
      `,
    ]);

    res.json({
      windows: normalizeWindowRows(windowRows),
      geography: splitGeoRows(geoRows),
      categories: normalizeCategoryRows(categoryRows),
    });
  } catch (err) {
    console.error('[admin/engagement/summary] Error:', err);
    res.status(500).json({ error: 'Failed to fetch engagement summary' });
  }
});

// POST /api/admin/roles/grant
router.post('/roles/grant', requireAuthProof(AUTH_ACTIONS.adminRolesGrant) as any, async (req: AuthenticatedRequest, res: Response) => {
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
router.post('/roles/revoke', requireAuthProof(AUTH_ACTIONS.adminRolesRevoke) as any, async (req: AuthenticatedRequest, res: Response) => {
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
router.post('/submissions/:id/verify', requireAuthProof(AUTH_ACTIONS.adminVerify) as any, async (req: AuthenticatedRequest, res: Response) => {
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
          // Verifying clears any prior rejection (the two states are exclusive).
          rejectedAt: verify ? null : undefined,
          rejectedBy: verify ? null : undefined,
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

// POST /api/admin/submissions/:id/reject
// Soft decline: keeps the row but flags it rejected and unpublishes it.
// `reject: false` restores the submission to pending. Distinct from DELETE.
router.post('/submissions/:id/reject', requireAuthProof(AUTH_ACTIONS.adminReject) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const submissionId = req.params.id;
    const reject = req.body.reject !== false; // default true
    const adminUserId = req.user!.sub;

    // A rejection the submitter cannot act on is the problem this endpoint
    // exists to avoid, so the reason is mandatory. Restoring needs none.
    const message = reject ? validateRejectionMessage(req.body.message) : null;
    if (reject && !message) {
      res.status(400).json({ success: false, error: 'A rejection reason is required.' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      const submission = await tx.submission.findUnique({ where: { id: submissionId } });
      if (!submission) {
        throw Object.assign(new Error('Submission not found'), { statusCode: 404 });
      }

      await tx.submission.update({
        where: { id: submissionId },
        data: {
          rejectedAt: reject ? new Date() : null,
          rejectedBy: reject ? adminUserId : null,
          rejectionMessage: message,
          // Snapshot of the editable fields, so resubmit can tell whether the
          // submitter actually changed anything.
          rejectionHash: reject ? submissionHash(submission) : null,
          // Rejecting unpublishes the reading; restoring returns it to pending
          // (not auto-verified; an admin still decides).
          verified: reject ? false : undefined,
          verifiedBy: reject ? null : undefined,
          verifiedAt: reject ? null : undefined,
        },
      });
    });

    res.json({ success: true, message: reject ? 'Submission rejected' : 'Submission restored' });
  } catch (err: any) {
    if (err?.statusCode === 404) {
      res.status(404).json({ success: false, error: 'Submission not found' });
      return;
    }
    console.error('[admin/submissions/reject] Error:', err);
    res.status(500).json({ success: false, error: 'Failed to reject submission' });
  }
});

// DELETE /api/admin/submissions/:id
router.delete('/submissions/:id', requireAuthProof(AUTH_ACTIONS.adminDelete) as any, async (req: AuthenticatedRequest, res: Response) => {
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

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
import { P2PKH, PublicKey, Utils, type WalletInterface, type WalletProtocol } from '@bsv/sdk';
import prisma from '../db/client.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import serverWallet, { SERVER_WALLET_CHAIN } from '../serverWallet.js';
import { createSubmissionTx, type SubmissionEntry } from '../lib/createSubmissionTx.js';
import { getTransaction } from '../lib/getTransaction.js';
import { buildSubmissionFilters } from '../lib/buildSubmissionFilters.js';
import { enqueueWalletTask } from '../lib/walletQueue.js';
import { anyoneWallet } from '../lib/anyoneWallet.js';
import { FIELD_LIMITS, exceedsLimit } from '../utils/limits.js';

// Protocol used to derive a P2PKH that the wallet recognises as its own.
const RECOVERY_PROTOCOL: WalletProtocol = [2, 'brixit recovery'];
const USER_SIGNING_PROTOCOL: WalletProtocol = [2, 'brixit submission'];

async function derivePayoutScript(wallet: WalletInterface, submissionUuid: string): Promise<string> {
  const { publicKey } = await wallet.getPublicKey({
    protocolID: RECOVERY_PROTOCOL,
    keyID: submissionUuid,
    counterparty: 'self',
  });
  const network = SERVER_WALLET_CHAIN === 'main' ? 'mainnet' : 'testnet';
  const address = PublicKey.fromString(publicKey).toAddress(network);
  return new P2PKH().lock(address).toHex();
}

const router = Router();

// Prisma include for full submission detail (authenticated context)
const FULL_SUBMISSION_INCLUDE = {
  crop: { select: { id: true, name: true, label: true, poorBrix: true, averageBrix: true, goodBrix: true, excellentBrix: true, category: true } },
  brand: { select: { id: true, name: true, label: true } },
  venue: { select: { id: true, name: true, posType: true, latitude: true, longitude: true, streetAddress: true, city: true, state: true, country: true } },
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
    place_id: s.venue?.id ?? null,
    place_label: s.venue?.name ?? null,
    latitude: s.venue?.latitude ?? null,
    longitude: s.venue?.longitude ?? null,
    street_address: s.venue?.streetAddress ?? null,
    city: s.venue?.city ?? null,
    state: s.venue?.state ?? null,
    country: s.venue?.country ?? null,
    pos_type: s.venue?.posType ?? null,
    skip_venue_prompt: s.skipVenuePrompt ?? false,
    outpoint: s.outpoint ?? null,
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

    const where = buildSubmissionFilters(req.query as Record<string, string | undefined>);

    // Map sortBy to Prisma orderBy
    const orderByMap: Record<string, any> = {
      assessment_date: { assessmentDate: sortOrder },
      brix_value: { brixValue: sortOrder },
      crop_name: { crop: { name: sortOrder } },
      place_label: { venue: { name: sortOrder } },
    };

    const submissions = await prisma.submission.findMany({
      where,
      include: {
        crop: { select: { id: true, name: true, label: true, poorBrix: true, averageBrix: true, goodBrix: true, excellentBrix: true, category: true } },
        brand: { select: { id: true, name: true, label: true } },
        venue: { select: { id: true, name: true, posType: true, latitude: true, longitude: true, streetAddress: true, city: true, state: true, country: true } },
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
      place_id: s.venue?.id ?? null,
      place_label: s.venue?.name ?? null,
      latitude: s.venue?.latitude ?? null,
      longitude: s.venue?.longitude ?? null,
      street_address: s.venue?.streetAddress ?? null,
      city: s.venue?.city ?? null,
      state: s.venue?.state ?? null,
      country: s.venue?.country ?? null,
      pos_type: s.venue?.posType ?? null,
      skip_venue_prompt: s.skipVenuePrompt ?? false,
      outpoint: s.outpoint ?? null,
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
    const where = buildSubmissionFilters(req.query as Record<string, string | undefined>);
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
        skipVenuePrompt: false,
        venue: {
          latitude: { not: null, gte: south, lte: north },
          longitude: { not: null, gte: west, lte: east },
        },
      },
      include: {
        crop: { select: { id: true, name: true, label: true, poorBrix: true, averageBrix: true, goodBrix: true, excellentBrix: true, category: true } },
        brand: { select: { id: true, name: true, label: true } },
        venue: { select: { id: true, name: true, posType: true, latitude: true, longitude: true, streetAddress: true, city: true, state: true, country: true } },
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
      place_id: s.venue?.id ?? null,
      place_label: s.venue?.name ?? null,
      latitude: s.venue?.latitude ?? null,
      longitude: s.venue?.longitude ?? null,
      street_address: s.venue?.streetAddress ?? null,
      city: s.venue?.city ?? null,
      state: s.venue?.state ?? null,
      country: s.venue?.country ?? null,
      pos_type: s.venue?.posType ?? null,
      skip_venue_prompt: s.skipVenuePrompt ?? false,
      outpoint: s.outpoint ?? null,
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

// --- Authenticated: GET /api/submissions/mine/venues ---
router.get('/mine/venues', requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.sub;
    const submissions = await prisma.submission.findMany({
      where: { userId, venueId: { not: null } },
      select: { venueId: true },
      distinct: ['venueId'],
    });
    res.json(submissions.map((s: { venueId: string | null }) => s.venueId).filter(Boolean));
  } catch (err) {
    console.error('[submissions/mine/venues] Error:', err);
    res.status(500).json({ error: 'Failed to fetch your venue IDs' });
  }
});

// --- Authenticated: POST /api/submissions/:id/retry-anchor ---
// Owner-only re-anchor for a submission whose initial anchor never landed.
router.post('/:id/retry-anchor', requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.sub;
    const submissionUuid = req.params.id;

    const submission = await prisma.submission.findUnique({
      where: { id: submissionUuid },
      select: { userId: true, outpoint: true },
    });
    if (!submission) {
      res.status(404).json({ error: 'Submission not found' });
      return;
    }
    if (submission.userId !== userId) {
      res.status(403).json({ error: 'Only the submission owner can retry its timestamp' });
      return;
    }
    if (submission.outpoint) {
      res.status(409).json({ error: 'Submission is already timestamped' });
      return;
    }

    const body = req.body;
    const payloadJson     = typeof body.payloadJson     === 'string' ? body.payloadJson     : null;
    const userSignature   = typeof body.userSignature   === 'string' ? body.userSignature   : null;
    const userKeyID       = typeof body.userKeyID        === 'string' ? body.userKeyID        : null;
    const userIdentityKey = typeof body.userIdentityKey  === 'string' ? body.userIdentityKey  : null;

    if (!payloadJson || !userSignature || !userKeyID || !userIdentityKey) {
      res.status(400).json({ error: 'Missing signing fields (payloadJson, userSignature, userKeyID, userIdentityKey).' });
      return;
    }

    const lengthErrors = [
      exceedsLimit(payloadJson, FIELD_LIMITS.PAYLOAD_JSON, 'payloadJson'),
      exceedsLimit(userSignature, FIELD_LIMITS.USER_SIGNATURE, 'userSignature'),
      exceedsLimit(userKeyID, FIELD_LIMITS.USER_KEY_ID, 'userKeyID'),
      exceedsLimit(userIdentityKey, FIELD_LIMITS.USER_IDENTITY_KEY, 'userIdentityKey'),
    ].filter((e): e is string => e !== null);
    if (lengthErrors.length > 0) {
      res.status(400).json({ error: lengthErrors[0] });
      return;
    }

    const walletIdentity = await prisma.walletIdentity.findUnique({
      where: { userId: submission.userId! },
      select: { identityKey: true },
    });
    if (!walletIdentity || walletIdentity.identityKey.toLowerCase() !== userIdentityKey.toLowerCase()) {
      res.status(403).json({ error: 'userIdentityKey does not match the submission owner.' });
      return;
    }

    try {
      await anyoneWallet.verifySignature({
        data: Utils.toArray(payloadJson, 'utf8'),
        signature: Utils.toArray(userSignature, 'hex'),
        protocolID: USER_SIGNING_PROTOCOL,
        keyID: userKeyID,
        counterparty: userIdentityKey,
      });
    } catch {
      res.status(400).json({ error: 'user signature did not verify against payloadJson.' });
      return;
    }

    const entry: SubmissionEntry = {
      submissionUuid,
      userIdentityKey,
      userKeyID,
      payloadJson,
      userSignature,
    };

    // Fire-and-forget. Re-read outpoint first: the serial queue makes repeat
    // retries idempotent — once one lands, the rest no-op.
    void enqueueWalletTask(async () => {
      try {
        const fresh = await prisma.submission.findUnique({
          where: { id: submissionUuid },
          select: { outpoint: true },
        });
        if (fresh?.outpoint) {
          console.log(`[anchor retry] ${submissionUuid} already anchored (${fresh.outpoint}); skipping`);
          return;
        }
        const anchor = await createSubmissionTx({ op: 'NEW', wallet: serverWallet, entries: [entry] });
        await prisma.submission.update({
          where: { id: submissionUuid },
          data: { outpoint: anchor.results[0].pushDropOutpoint ?? null },
        });
        console.log(`[anchor retry] ${submissionUuid} → ${anchor.txid}`);
      } catch (err) {
        console.error(`[anchor retry] failed for ${submissionUuid}:`, err);
      }
    });

    res.status(202).json({ message: 'Anchor retry queued' });
  } catch (err) {
    console.error('[submissions/:id/retry-anchor] Error:', err);
    res.status(500).json({ error: 'Failed to retry timestamp' });
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
      select: { userId: true, verified: true, outpoint: true },
    });

    if (!submission) {
      res.status(404).json({ error: 'Submission not found' });
      return;
    }

    // Editing a submission's data is owner-only. Admins moderate via separate
    // endpoints: verify/reject through POST /api/admin/submissions/:id/verify and
    // removal through DELETE. They may still edit their *own* submissions.
    const isAdmin = roles.includes('admin');
    if (submission.userId !== userId) {
      res.status(403).json({ error: 'Only the submission owner can edit it' });
      return;
    }

    // Build Prisma update data from request body
    const body = req.body;
    const data: any = {};

    // Enforce length caps on free-form strings before persisting.
    const lengthErrors = [
      exceedsLimit(body.outlier_notes, FIELD_LIMITS.NOTES, 'outlier_notes'),
      exceedsLimit(body.crop_variety, FIELD_LIMITS.CROP_VARIETY, 'crop_variety'),
      exceedsLimit(body.payloadJson, FIELD_LIMITS.PAYLOAD_JSON, 'payloadJson'),
      exceedsLimit(body.userSignature, FIELD_LIMITS.USER_SIGNATURE, 'userSignature'),
      exceedsLimit(body.userKeyID, FIELD_LIMITS.USER_KEY_ID, 'userKeyID'),
      exceedsLimit(body.userIdentityKey, FIELD_LIMITS.USER_IDENTITY_KEY, 'userIdentityKey'),
    ].filter((e): e is string => e !== null);
    if (lengthErrors.length > 0) {
      res.status(400).json({ error: lengthErrors[0] });
      return;
    }

    if (body.brix_value !== undefined) data.brixValue = body.brix_value;
    if (body.crop_variety !== undefined) data.cropVariety = body.crop_variety;
    if (body.assessment_date !== undefined) data.assessmentDate = new Date(body.assessment_date);
    if (body.purchase_date !== undefined) data.purchaseDate = body.purchase_date ? new Date(body.purchase_date) : null;
    if (body.outlier_notes !== undefined) data.outlierNotes = body.outlier_notes;
    if (body.crop_id !== undefined) data.cropId = body.crop_id;
    if (body.brand_id !== undefined) data.brandId = body.brand_id;
    if (body.venue_id !== undefined) data.venueId = body.venue_id;

    // Only admin can update verification status
    if (isAdmin) {
      if (body.verified !== undefined) data.verified = body.verified;
      if (body.verified_by !== undefined) data.verifiedBy = body.verified_by;
      if (body.verified_at !== undefined) data.verifiedAt = body.verified_at ? new Date(body.verified_at) : null;
    }

    // ── On-chain re-anchor (if signing fields present) ─────────────────────
    const payloadJson      = typeof body.payloadJson      === 'string' ? body.payloadJson      : null;
    const userSignature    = typeof body.userSignature    === 'string' ? body.userSignature    : null;
    const userKeyID        = typeof body.userKeyID        === 'string' ? body.userKeyID        : null;
    const userIdentityKey  = typeof body.userIdentityKey  === 'string' ? body.userIdentityKey  : null;
    const hasSigningFields = !!(payloadJson && userSignature && userKeyID && userIdentityKey);

    if (hasSigningFields) {
      const walletIdentity = await prisma.walletIdentity.findUnique({
        where: { userId: submission.userId! },
        select: { identityKey: true },
      });
      if (!walletIdentity || walletIdentity.identityKey.toLowerCase() !== userIdentityKey!.toLowerCase()) {
        res.status(403).json({ error: 'userIdentityKey does not match the submission owner.' });
        return;
      }
      // Crypto-verify upfront so the anchor task can't trip on a bad signature.
      try {
        await anyoneWallet.verifySignature({
          data: Utils.toArray(payloadJson!, 'utf8'),
          signature: Utils.toArray(userSignature!, 'hex'),
          protocolID: USER_SIGNING_PROTOCOL,
          keyID: userKeyID!,
          counterparty: userIdentityKey!,
        });
      } catch {
        res.status(400).json({ error: 'user signature did not verify against payloadJson.' });
        return;
      }
      // Keep the old outpoint while we re-anchor — if the anchor task fails,
      // a retry or DELETE still has a valid previous UTXO to spend.
    }

    const updated = await prisma.submission.update({
      where: { id: req.params.id },
      data,
      include: FULL_SUBMISSION_INCLUDE,
    });

    if (hasSigningFields) {
      const submissionUuid = req.params.id;
      const entry: SubmissionEntry = {
        submissionUuid,
        userIdentityKey: userIdentityKey!,
        userKeyID: userKeyID!,
        payloadJson: payloadJson!,
        userSignature: userSignature!,
      };

      void enqueueWalletTask(async () => {
        try {
          // Re-read outpoint: a concurrent retry/edit may have anchored while
          // we were queued, so EDIT the current one rather than duplicate it.
          const current = await prisma.submission.findUnique({
            where: { id: submissionUuid },
            select: { outpoint: true },
          });
          const previousOutpoint = current?.outpoint ?? null;

          let outpoint: string | undefined;
          if (previousOutpoint) {
            // EDIT — spend the previous PushDrop, produce a new one.
            const previous = await getTransaction(serverWallet, previousOutpoint);
            const anchor = await createSubmissionTx({
              op: 'EDIT',
              wallet: serverWallet,
              entry,
              previousTxid: previousOutpoint.split('.')[0],
              previous,
            });
            outpoint = anchor.results[0].pushDropOutpoint;
            console.log(`[anchor edit] ${submissionUuid} → ${anchor.txid}`);
          } else {
            // First-time anchor — original NEW never landed, treat this edit as the anchor.
            const anchor = await createSubmissionTx({
              op: 'NEW',
              wallet: serverWallet,
              entries: [entry],
            });
            outpoint = anchor.results[0].pushDropOutpoint;
            console.log(`[anchor edit→new] ${submissionUuid} → ${anchor.txid}`);
          }
          await prisma.submission.update({
            where: { id: submissionUuid },
            data: { outpoint: outpoint ?? null },
          });
        } catch (err) {
          console.error(`[anchor edit] failed for ${submissionUuid}:`, err);
        }
      });
    }

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
      select: { userId: true, outpoint: true },
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

    // Spend the previous PushDrop UTXO into a P2PKH back to the server wallet.
    // Fire-and-forget — the DB row is already gone; failure leaves a stale UTXO
    // in the basket that admin reconciliation can sweep later.
    if (submission.outpoint) {
      const previousOutpoint = submission.outpoint;
      const submissionUuid = req.params.id;
      void enqueueWalletTask(async () => {
        try {
          const previous = await getTransaction(serverWallet, previousOutpoint);
          const payoutScript = await derivePayoutScript(serverWallet, submissionUuid);
          const payoutCustomInstructions = JSON.stringify({
            protocolID: RECOVERY_PROTOCOL,
            keyID: submissionUuid,
          });
          const anchor = await createSubmissionTx({
            op: 'DELETE',
            wallet: serverWallet,
            submissionUuid,
            previousTxid: previousOutpoint.split('.')[0],
            previous,
            deletionPayoutLockingScriptHex: payoutScript,
            deletionPayoutSatoshis: previous.sourceSatoshis,
            deletionPayoutCustomInstructions: payoutCustomInstructions,
          });
          console.log(`[anchor delete] ${submissionUuid} → ${anchor.txid}`);
        } catch (err) {
          console.error(`[anchor delete] failed for ${submissionUuid}:`, err);
        }
      });
    }

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

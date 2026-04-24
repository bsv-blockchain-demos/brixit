/**
 * Submission processing + auto-verification route.
 *
 * Endpoint:
 *   POST /api/submissions/create
 *
 * Accepts a session context (shared across all readings) plus an array of
 * crop readings.  All DB writes execute in a single transaction — brand,
 * venue, and every submission row commit together or not at all.
 *
 * Request body:
 *   {
 *     brandName, assessmentDate, purchaseDate, outlierNotes,
 *     latitude, longitude, locationName,
 *     street_address, city, state, country,
 *     poi_name, business_name, normalized_address, store_name, pos_type,
 *     venueId, newVenue, skipVenuePrompt,
 *     readings: [{ cropName, brixValue }, ...]
 *   }
 *
 * Response:
 *   { submissions: [{ submission_id, verified }, ...] }
 */
import { Router } from 'express';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { config } from '../config.js';
import {
  sanitizeInput,
  fixPrecision,
  parseAddressString,
  type ParsedAddress,
} from '../utils/sanitize.js';
import prisma from '../db/client.js';

const router = Router();

// ─── Types ───────────────────────────────────────────────────────────────────

interface ReadingInput {
  cropName?: unknown;
  brixValue?: unknown;
  brandName?: unknown;
  notes?: unknown;
}

interface BulkSubmissionRequestBody {
  brandName?: unknown;
  assessmentDate?: unknown;
  purchaseDate?: unknown;
  userId?: unknown;
  outlierNotes?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  locationName?: unknown;
  street_address?: unknown;
  city?: unknown;
  state?: unknown;
  country?: unknown;
  poi_name?: unknown;
  business_name?: unknown;
  normalized_address?: unknown;
  store_name?: unknown;
  pos_type?: unknown;
  venueId?: unknown;
  newVenue?: unknown;
  skipVenuePrompt?: unknown;
  readings?: unknown;
}

// ─── Route handler ────────────────────────────────────────────────────────────

router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const authedUserId = req.user!.sub;
    const body = req.body as BulkSubmissionRequestBody;

    // ── Verify claimed userId ──────────────────────────────────────────────
    if (body.userId && String(body.userId) !== authedUserId) {
      res.status(403).json({ error: 'userId does not match authenticated user' });
      return;
    }

    // ── Validate shared session fields ─────────────────────────────────────
    const assessmentDateStr = typeof body.assessmentDate === 'string' ? body.assessmentDate : null;
    if (!assessmentDateStr) {
      res.status(400).json({ error: 'assessmentDate is required' });
      return;
    }

    if (body.latitude == null || body.longitude == null) {
      res.status(400).json({ error: 'Latitude and longitude are required.' });
      return;
    }
    const latNum = typeof body.latitude === 'number' ? body.latitude : Number(body.latitude);
    const lngNum = typeof body.longitude === 'number' ? body.longitude : Number(body.longitude);
    const fixedLat = fixPrecision(latNum);
    const fixedLng = fixPrecision(lngNum);
    if (isNaN(fixedLat) || isNaN(fixedLng)) {
      res.status(400).json({ error: 'Invalid latitude or longitude.' });
      return;
    }

    // ── Validate readings array ────────────────────────────────────────────
    if (!Array.isArray(body.readings) || body.readings.length === 0) {
      res.status(400).json({ error: 'readings must be a non-empty array.' });
      return;
    }
    const rawReadings = body.readings as ReadingInput[];

    // ── Pre-validate + look up each crop (read-only, outside transaction) ──
    interface ResolvedReading {
      cropId: string;
      brix: number;
      poorBrixNum: number | null;
      excellentBrixNum: number | null;
      brandName: string | null;
      notes: string | null;
    }

    const sessionBrandName = sanitizeInput(body.brandName);
    const sessionNotes = sanitizeInput(body.outlierNotes);
    const resolvedReadings: ResolvedReading[] = [];

    for (let i = 0; i < rawReadings.length; i++) {
      const r = rawReadings[i];
      const sanitizedCropName = sanitizeInput(r.cropName);
      if (!sanitizedCropName) {
        res.status(400).json({ error: `Reading ${i + 1}: cropName is required.` });
        return;
      }

      const brixValueNum = typeof r.brixValue === 'number' ? r.brixValue : Number(r.brixValue);
      const brix = parseFloat(Number(brixValueNum).toFixed(2));
      if (Number.isNaN(brix) || brix < 0 || brix > 100) {
        res.status(400).json({ error: `Reading ${i + 1}: brixValue must be between 0 and 100.` });
        return;
      }

      const cropData = await prisma.crop.findFirst({
        where: { name: { equals: sanitizedCropName, mode: 'insensitive' } },
        select: { id: true, poorBrix: true, excellentBrix: true },
      });
      if (!cropData) {
        res.status(400).json({ error: `Reading ${i + 1}: No crop found for '${sanitizedCropName}'.` });
        return;
      }

      resolvedReadings.push({
        cropId: cropData.id,
        brix,
        poorBrixNum: cropData.poorBrix ? Number(cropData.poorBrix) : null,
        excellentBrixNum: cropData.excellentBrix ? Number(cropData.excellentBrix) : null,
        brandName: sanitizeInput(r.brandName) ?? sessionBrandName,
        notes: sanitizeInput(r.notes) ?? sessionNotes,
      });
    }

    // ── Look up contributor name (read-only) ───────────────────────────────
    const userData = await prisma.user.findUnique({
      where: { id: authedUserId },
      select: { displayName: true, email: true },
    });
    const contributorName: string | null = userData?.displayName || userData?.email || null;

    // ── Address parsing ────────────────────────────────────────────────────
    const sanitizedStoreName = sanitizeInput(body.store_name);
    let parsedAddress: ParsedAddress = {};
    let finalStreetAddress = sanitizeInput(body.street_address);
    let finalCity = sanitizeInput(body.city);
    let finalState = sanitizeInput(body.state);
    let finalCountry = sanitizeInput(body.country);

    if (finalStreetAddress && finalStreetAddress.includes(',')) {
      parsedAddress = parseAddressString(finalStreetAddress);
      finalStreetAddress = parsedAddress.street_address ?? finalStreetAddress;
      finalCity = finalCity ?? parsedAddress.city ?? null;
      finalState = finalState ?? parsedAddress.state ?? null;
      finalCountry = finalCountry ?? parsedAddress.country ?? null;
    }

    const purchaseDateStr = typeof body.purchaseDate === 'string' ? body.purchaseDate : null;

    // ── Single transaction: venue + brand + all submissions ───────────────
    const submissionResults = await prisma.$transaction(async (tx) => {
      // Resolve venue
      const skipVenue = body.skipVenuePrompt === true;
      let venueId: string | null = null;

      if (!skipVenue) {
        const existingVenueId = typeof body.venueId === 'string' ? body.venueId : null;

        if (existingVenueId) {
          // Use selected existing venue
          venueId = existingVenueId;
        } else {
          // Determine name: from newVenue, or from Mapbox poi_name/business_name
          const newVenuePayload = body.newVenue && typeof body.newVenue === 'object'
            ? body.newVenue as { name?: string; posType?: string }
            : null;

          const poiName = sanitizeInput(body.poi_name);
          const businessName = sanitizeInput(body.business_name);
          const venueName = newVenuePayload?.name
            ? sanitizeInput(newVenuePayload.name)
            : (businessName || poiName || sanitizeInput(body.store_name));

          if (venueName) {
            // Deduplicate: find within ~100m, case-insensitive name match
            const tolerance = 0.001;
            const existing = await tx.$queryRaw<{ id: string }[]>`
              SELECT id FROM venues
              WHERE lower(name) = lower(${venueName})
                AND ABS(latitude - ${fixedLat}) < ${tolerance}
                AND ABS(longitude - ${fixedLng}) < ${tolerance}
              LIMIT 1
            `;

            if (existing.length > 0) {
              venueId = existing[0].id;
            } else {
              const venue = await tx.venue.create({
                data: {
                  name: venueName,
                  posType: newVenuePayload?.posType ?? sanitizeInput(body.pos_type) ?? null,
                  latitude: fixedLat,
                  longitude: fixedLng,
                  streetAddress: finalStreetAddress,
                  city: finalCity,
                  state: finalState,
                  country: finalCountry,
                  verified: !newVenuePayload, // system-created = verified, community = unverified
                  createdByUserId: newVenuePayload ? authedUserId : null,
                },
              });
              venueId = venue.id;
            }
          }
        }
      }

      // Insert one submission per reading
      const results: { submission_id: string; verified: boolean }[] = [];

      for (const reading of resolvedReadings) {
        const { cropId, brix, poorBrixNum, excellentBrixNum, brandName: readingBrandName, notes } = reading;

        // Per-reading brand find-or-create
        let brandId: string | null = null;
        if (readingBrandName && readingBrandName.toLowerCase() !== 'unknown') {
          const existingBrand = await tx.brand.findFirst({
            where: { name: { equals: readingBrandName, mode: 'insensitive' } },
          });
          brandId = existingBrand
            ? existingBrand.id
            : (await tx.brand.create({ data: { name: readingBrandName } })).id;
        }

        let isVerified = true;
        let verifiedById: string | null = null;
        let verifiedAt: Date | null = null;

        if (
          (poorBrixNum !== null && brix < poorBrixNum) ||
          (excellentBrixNum !== null && brix > excellentBrixNum * 1.2)
        ) {
          isVerified = false;
        } else {
          verifiedById = config.autoVerifyUserId || null;
          verifiedAt = new Date();
        }

        const submission = await tx.submission.create({
          data: {
            cropId,
            venueId,
            brandId,
            skipVenuePrompt: skipVenue,
            cropVariety: null,
            brixValue: brix,
            userId: authedUserId,
            contributorName,
            assessmentDate: new Date(assessmentDateStr),
            purchaseDate: purchaseDateStr ? new Date(purchaseDateStr) : null,
            outlierNotes: notes,
            verified: isVerified,
            verifiedBy: verifiedById,
            verifiedAt,
          },
        });

        results.push({ submission_id: submission.id, verified: isVerified });
      }

      // User stats: single update for the whole batch
      const verifiedCount = results.filter(r => r.verified).length;
      const unverifiedCount = results.length - verifiedCount;
      await tx.user.update({
        where: { id: authedUserId },
        data: {
          submissionCount: { increment: results.length },
          points: { increment: verifiedCount * 10 + unverifiedCount * 5 },
          lastSubmission: new Date(),
        },
      });

      return results;
    }, { timeout: 30_000 });

    res.json({
      message: 'Submission(s) processed successfully',
      submissions: submissionResults,
    });
  } catch (err) {
    console.error('[auto-verify-submission] Error:', err);
    res.status(500).json({ error: 'Submission processing failed. Please try again.' });
  }
});

export default router;

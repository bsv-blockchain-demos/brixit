/**
 * Submission processing + auto-verification route.
 * Migrated from: supabase/functions/auto-verify-submission/index.ts
 *
 * Endpoint:
 *   POST /api/submissions
 *
 * Requires: authenticated user with 'admin' or 'contributor' role.
 * Auth is handled by middleware before this handler runs.
 *
 * Flow:
 *   1. (Auth handled by middleware — req.user is populated)
 *   2. Validate & sanitize input
 *   3. Crop lookup by name
 *   4. Auto-verify logic (brix within thresholds?)
 *   5. Brand find-or-create
 *   6. Place find-or-create (coordinate proximity search)
 *   7. Location matching
 *   8. Insert submission row
 *   9. Return result
 *
 * NOTE: DB calls are stubbed with TODO comments.
 *       These will be implemented once the database layer is decided.
 */
import { Router } from 'express';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { config } from '../config.js';
import {
  sanitizeInput,
  fixPrecision,
  parseAddressString,
  createHumanReadableLabel,
  type ParsedAddress,
} from '../utils/sanitize.js';
import prisma from '../db/client.js';

const router = Router();

// --- Types (ported from edge function) ---

interface SubmissionRequestBody {
  cropName?: unknown;
  brandName?: unknown;
  brixValue?: unknown;
  assessmentDate?: unknown;
  purchaseDate?: unknown;
  userId?: unknown;
  variety?: unknown;
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
}

// --- Route handler ---

router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const authedUserId = req.user!.sub;

    // --- Parse body ---
    const submissionData = req.body as SubmissionRequestBody;

    const {
      cropName,
      brandName,
      brixValue,
      assessmentDate,
      purchaseDate,
      userId: claimedUserId,
      variety,
      outlierNotes,
      latitude,
      longitude,
      locationName,
      street_address,
      city,
      state,
      country,
      poi_name,
      business_name,
      normalized_address,
      store_name,
    } = submissionData;

    // Verify claimed userId matches authenticated user
    if (claimedUserId && String(claimedUserId) !== authedUserId) {
      res.status(403).json({ error: 'userId does not match authenticated user' });
      return;
    }

    const userId = authedUserId;

    // --- Contributor name ---
    const userData = await prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true, email: true },
    });
    const contributorName: string | null = userData?.displayName || userData?.email || null;

    // --- Validation ---
    const sanitizedCropName = sanitizeInput(cropName);
    if (!sanitizedCropName) {
      res.status(400).json({ error: 'Crop name is required.' });
      return;
    }

    const assessmentDateStr = typeof assessmentDate === 'string' ? assessmentDate : null;
    if (!assessmentDateStr) {
      res.status(400).json({ error: 'assessmentDate is required' });
      return;
    }

    const brixValueNum = typeof brixValue === 'number' ? brixValue : Number(brixValue);
    const brix = parseFloat(Number(brixValueNum).toFixed(2));
    if (Number.isNaN(brix) || brix < 0 || brix > 100) {
      res.status(400).json({ error: 'Brix value must be a number between 0 and 100.' });
      return;
    }

    if (latitude == null || longitude == null) {
      res.status(400).json({ error: 'Latitude and longitude are required.' });
      return;
    }

    const latNum = typeof latitude === 'number' ? latitude : Number(latitude);
    const lngNum = typeof longitude === 'number' ? longitude : Number(longitude);
    const fixedLat = fixPrecision(latNum);
    const fixedLng = fixPrecision(lngNum);
    if (isNaN(fixedLat) || isNaN(fixedLng)) {
      res.status(400).json({ error: 'Invalid latitude or longitude supplied.' });
      return;
    }

    // --- Crop Lookup ---
    const cropData = await prisma.crop.findFirst({
      where: { name: { equals: sanitizedCropName, mode: 'insensitive' } },
      select: { id: true, poorBrix: true, excellentBrix: true },
    });
    if (!cropData) {
      res.status(400).json({ error: `No crop found for '${sanitizedCropName}'.` });
      return;
    }

    const { id: cropId, poorBrix, excellentBrix } = cropData;
    const poorBrixNum = poorBrix ? Number(poorBrix) : null;
    const excellentBrixNum = excellentBrix ? Number(excellentBrix) : null;

    // --- Auto-verify logic ---
    let isVerified = true;
    let verifiedById: string | null = null;
    let verifiedAt: string | null = null;

    if ((poorBrixNum !== null && brix < poorBrixNum) || (excellentBrixNum !== null && brix > excellentBrixNum * 1.2)) {
      isVerified = false;
    } else {
      verifiedById = config.autoVerifyUserId || null;
      verifiedAt = new Date().toISOString();
    }

    // --- Brand handling ---
    let brandId: string | null = null;
    const sanitizedBrandName = sanitizeInput(brandName);
    if (sanitizedBrandName) {
      const existingBrand = await prisma.brand.findFirst({
        where: { name: { equals: sanitizedBrandName, mode: 'insensitive' } },
      });
      if (existingBrand) {
        brandId = existingBrand.id;
      } else {
        const newBrand = await prisma.brand.create({ data: { name: sanitizedBrandName } });
        brandId = newBrand.id;
      }
    }

    // --- Location & Place handling ---
    let locationId: string | null = null;
    let existingPlace: { id: string; locationId: string | null } | null = null;

    const sanitizedStoreName = sanitizeInput(store_name);
    let parsedAddress: ParsedAddress = {};
    let finalStreetAddress = sanitizeInput(street_address);
    let finalCity = sanitizeInput(city);
    let finalState = sanitizeInput(state);
    let finalCountry = sanitizeInput(country);

    if (finalStreetAddress && finalStreetAddress.includes(',')) {
      parsedAddress = parseAddressString(finalStreetAddress);
      finalStreetAddress = parsedAddress.street_address ?? finalStreetAddress;
      finalCity = finalCity ?? parsedAddress.city ?? null;
      finalState = finalState ?? parsedAddress.state ?? null;
      finalCountry = finalCountry ?? parsedAddress.country ?? null;
    }

    const tolerance = 0.0001;

    // Location lookup
    if (sanitizedStoreName) {
      const matchingLocation = await prisma.location.findFirst({
        where: { name: { equals: sanitizedStoreName, mode: 'insensitive' } },
      });
      if (matchingLocation) locationId = matchingLocation.id;
    } else if (business_name || poi_name) {
      const businessOrPoi = sanitizeInput(business_name || poi_name);
      if (businessOrPoi) {
        const businessLocation = await prisma.location.findFirst({
          where: { name: { equals: businessOrPoi, mode: 'insensitive' } },
        });
        if (businessLocation) locationId = businessLocation.id;
      }
    }

    // Place proximity search
    const nearbyPlaces = await prisma.place.findMany({
      where: {
        latitude: { gte: fixedLat - tolerance, lte: fixedLat + tolerance },
        longitude: { gte: fixedLng - tolerance, lte: fixedLng + tolerance },
      },
      take: 5,
    });
    if (nearbyPlaces.length > 0) {
      existingPlace = nearbyPlaces.find((p: { id: string; locationId: string | null }) => p.locationId === locationId) || nearbyPlaces[0];
    }

    let placeId: string;

    if (existingPlace) {
      placeId = existingPlace.id;
      if (!existingPlace.locationId && locationId) {
        await prisma.place.update({
          where: { id: existingPlace.id },
          data: { locationId },
        });
      }
    } else {
      const placeLabel = createHumanReadableLabel({
        store_name: sanitizedStoreName,
        business_name: sanitizeInput(business_name),
        poi_name: sanitizeInput(poi_name),
        street_address: finalStreetAddress,
        city: finalCity,
        state: finalState,
        country: finalCountry,
        locationName: sanitizeInput(locationName),
      });
      const newPlace = await prisma.place.create({
        data: {
          label: placeLabel,
          latitude: fixedLat,
          longitude: fixedLng,
          streetAddress: finalStreetAddress,
          city: finalCity,
          state: finalState,
          country: finalCountry,
          locationId,
          normalizedAddress: sanitizeInput(normalized_address),
        },
      });
      placeId = newPlace.id;
    }

    // --- Submission insert ---
    const purchaseDateStr = typeof purchaseDate === 'string' ? purchaseDate : null;

    const submission = await prisma.submission.create({
      data: {
        cropId,
        placeId,
        locationId,
        brandId,
        cropVariety: sanitizeInput(variety),
        brixValue: brix,
        userId,
        contributorName,
        assessmentDate: new Date(assessmentDateStr),
        purchaseDate: purchaseDateStr ? new Date(purchaseDateStr) : null,
        outlierNotes: sanitizeInput(outlierNotes),
        verified: isVerified,
        verifiedBy: verifiedById,
        verifiedAt: verifiedAt ? new Date(verifiedAt) : null,
      },
    });

    // Update user submission stats
    await prisma.user.update({
      where: { id: userId },
      data: {
        submissionCount: { increment: 1 },
        points: { increment: isVerified ? 10 : 5 },
        lastSubmission: new Date(),
      },
    });

    res.json({
      message: 'Submission processed successfully',
      verified: isVerified,
      submission_id: submission.id,
      location_matched: locationId !== null,
      place_created: !existingPlace,
    });
  } catch (err) {
    console.error('[auto-verify-submission] Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({
      error: 'Submission processing failed',
      details: message,
    });
  }
});

export default router;

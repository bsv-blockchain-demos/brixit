/**
 * Builds the Prisma `where` clause for public submission queries from URL
 * query params. Shared by `GET /api/submissions` (list) and
 * `GET /api/submissions/count` so they never disagree on filtering.
 *
 * Pins `verified: true` by default — the public endpoints only expose approved
 * readings. The authenticated /mine routes pass `verifiedOnly: false`, since
 * you are allowed to see your own readings while they are still pending.
 */

export type SubmissionFilterQuery = {
  cropTypes?: string;
  category?: string;
  city?: string;
  state?: string;
  country?: string;
  place?: string;
  location?: string;
  brand?: string;
  brixMin?: string;
  brixMax?: string;
  dateStart?: string;
  dateEnd?: string;
  search?: string;
  timestamped?: string;
};

export function buildSubmissionFilters(
  query: SubmissionFilterQuery,
  options: { verifiedOnly?: boolean } = {},
): Record<string, any> {
  const { verifiedOnly = true } = options;
  const where: Record<string, any> = verifiedOnly ? { verified: true } : {};

  // Timestamped = recorded on-chain (outpoint present).
  if (query.timestamped === 'true') {
    where.outpoint = { not: null };
  }

  if (query.cropTypes) {
    const cropNames = query.cropTypes.split(',').map((s) => s.trim()).filter(Boolean);
    if (cropNames.length > 0) {
      where.crop = { name: { in: cropNames } };
    }
  }
  if (query.category) {
    where.crop = { ...where.crop, category: query.category };
  }
  if (query.city) {
    where.venue = { ...where.venue, city: { equals: query.city, mode: 'insensitive' } };
  }
  if (query.state) {
    where.venue = { ...where.venue, state: { equals: query.state, mode: 'insensitive' } };
  }
  if (query.country) {
    where.venue = { ...where.venue, country: { equals: query.country, mode: 'insensitive' } };
  }

  // `place` and `location` both match venue name (leaderboard back-compat).
  const venueName = query.place || query.location;
  if (venueName) {
    where.venue = { ...where.venue, name: { equals: venueName, mode: 'insensitive' } };
  }

  if (query.brand) {
    // Filter value may be the brand name or its label (dropdown / leaderboard differ).
    where.brand = {
      OR: [
        { name: { equals: query.brand, mode: 'insensitive' } },
        { label: { equals: query.brand, mode: 'insensitive' } },
      ],
    };
  }

  if (query.brixMin !== undefined && query.brixMin !== '') {
    const n = Number(query.brixMin);
    if (Number.isFinite(n)) where.brixValue = { ...where.brixValue, gte: n };
  }
  if (query.brixMax !== undefined && query.brixMax !== '') {
    const n = Number(query.brixMax);
    if (Number.isFinite(n)) where.brixValue = { ...where.brixValue, lte: n };
  }

  if (query.dateStart) {
    const d = new Date(query.dateStart);
    if (!isNaN(d.getTime())) where.assessmentDate = { ...where.assessmentDate, gte: d };
  }
  if (query.dateEnd) {
    const d = new Date(query.dateEnd);
    if (!isNaN(d.getTime())) where.assessmentDate = { ...where.assessmentDate, lte: d };
  }

  if (query.search) {
    const s = query.search.trim();
    if (s.length > 0) {
      where.OR = [
        { crop: { name: { contains: s, mode: 'insensitive' } } },
        { crop: { label: { contains: s, mode: 'insensitive' } } },
        { brand: { name: { contains: s, mode: 'insensitive' } } },
        { brand: { label: { contains: s, mode: 'insensitive' } } },
        { venue: { name: { contains: s, mode: 'insensitive' } } },
        { outlierNotes: { contains: s, mode: 'insensitive' } },
      ];
    }
  }

  return where;
}

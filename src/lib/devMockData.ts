/**
 * DEV-only mock readings, so the data browser has something to render
 * without a backend.
 *
 * Enable with VITE_DEV_MOCK_DATA=1 in your local .env.
 *
 * Safety: gated on `import.meta.env.DEV`, which is statically false in a
 * production build, so the flag folds to `false` and the generator is dropped
 * as dead code. It cannot be switched on in a shipped bundle.
 *
 * Scope: sorting, pagination, and most filters (search, crop, brand, place,
 * city/state/country, BRIX range, blockchain) are simulated so the table
 * behaves believably. Date filters are not, and neither is anything that
 * writes.
 */
import type { BrixDataPoint } from '@/types';
import type { PublicFormattedSubmissionsQuery } from './fetchSubmissions';

const CROPS = [
  { id: 'crop-tomato', name: 'tomato', label: 'Tomato', category: 'Vegetable', poor: 4, avg: 6, good: 8, excellent: 12 },
  { id: 'crop-carrot', name: 'carrot', label: 'Carrot', category: 'Vegetable', poor: 4, avg: 6, good: 12, excellent: 18 },
  { id: 'crop-spinach', name: 'spinach', label: 'Spinach', category: 'Leafy Green', poor: 4, avg: 6, good: 8, excellent: 12 },
  { id: 'crop-apple', name: 'apple', label: 'Apple', category: 'Fruit', poor: 6, avg: 10, good: 14, excellent: 18 },
  { id: 'crop-grape', name: 'grape', label: 'Grape', category: 'Fruit', poor: 8, avg: 12, good: 16, excellent: 20 },
  { id: 'crop-kale', name: 'kale', label: 'Kale', category: 'Leafy Green', poor: 4, avg: 6, good: 10, excellent: 14 },
];

const BRANDS = [
  { id: 'brand-1', name: "Olivia's Organics", label: "Olivia's Organics" },
  { id: 'brand-2', name: 'Sunridge Farm', label: 'Sunridge Farm' },
  { id: 'brand-3', name: 'Green Valley', label: 'Green Valley' },
  { id: 'brand-4', name: 'Harvest Roots', label: 'Harvest Roots' },
];

const PLACES = [
  { id: 'place-1', name: 'City Market Co-op', street: '82 S Winooski Ave', city: 'Burlington', state: 'Vermont', lat: 44.4759, lng: -73.2121 },
  { id: 'place-2', name: 'Healthy Living', street: '222 Dorset St', city: 'South Burlington', state: 'Vermont', lat: 44.4526, lng: -73.1918 },
  { id: 'place-3', name: 'Union Square Greenmarket', street: 'E 17th St', city: 'New York', state: 'New York', lat: 40.7359, lng: -73.9911 },
  { id: 'place-4', name: 'Ferry Plaza Farmers Market', street: '1 Ferry Building', city: 'San Francisco', state: 'California', lat: 37.7955, lng: -122.3937 },
];

const SUBMITTERS = ['Dev Explorer', 'Test Contributor', 'Ada L.', 'Grace H.', 'Rosalind F.'];
const POS_TYPES = ['Supermarket', 'Farmers Market', 'Farm Direct'];

/** Deterministic pseudo-random so the table is stable across reloads. */
function seeded(i: number, salt: number) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// Built on first use rather than at module load: no top-level work means
// nothing here has side effects for the bundler to preserve.
let cached: BrixDataPoint[] | null = null;
const buildDataset = (): BrixDataPoint[] => Array.from({ length: 137 }, (_, i) => {
  const crop = CROPS[i % CROPS.length];
  const brand = BRANDS[Math.floor(seeded(i, 1) * BRANDS.length)];
  const place = PLACES[Math.floor(seeded(i, 2) * PLACES.length)];
  const brix = Math.round((crop.poor + seeded(i, 3) * (crop.excellent + 2 - crop.poor)) * 10) / 10;
  const submittedAt = new Date(Date.now() - i * 8.5 * 3600 * 1000).toISOString();
  const verified = seeded(i, 4) > 0.35;

  return {
    id: `mock-${String(i + 1).padStart(4, '0')}`,
    brixLevel: brix,
    verified,
    verifiedAt: verified ? submittedAt : null,
    variety: '',
    cropType: crop.name,
    category: crop.category,
    latitude: place.lat,
    longitude: place.lng,
    locationName: place.name,
    placeName: place.name,
    streetAddress: place.street,
    city: place.city,
    state: place.state,
    country: 'United States',
    brandName: brand.name,
    submittedBy: SUBMITTERS[Math.floor(seeded(i, 5) * SUBMITTERS.length)],
    userId: i % 4 === 0 ? 'dev-user-0000-0000-0000-000000000000' : `mock-user-${i % 7}`,
    verifiedBy: verified ? 'Dev Explorer' : '',
    submittedAt,
    outlier_notes: seeded(i, 6) > 0.85 ? 'Sampled from the middle of the batch.' : '',
    images: [],
    poorBrix: crop.poor,
    averageBrix: crop.avg,
    goodBrix: crop.good,
    excellentBrix: crop.excellent,
    purchaseDate: submittedAt,
    posType: POS_TYPES[Math.floor(seeded(i, 7) * POS_TYPES.length)],
    cropId: crop.id,
    placeId: place.id,
    brandId: brand.id,
    verifiedByUserId: verified ? 'dev-user-0000-0000-0000-000000000000' : '',
    cropLabel: crop.label,
    brandLabel: brand.label,
    outpoint: seeded(i, 8) > 0.5 ? `${'a'.repeat(64)}_${i}` : null,
  } satisfies BrixDataPoint;
});

const dataset = (): BrixDataPoint[] => (cached ??= buildDataset());

type AnyQuery = Partial<PublicFormattedSubmissionsQuery> & Record<string, unknown>;

/** Applies the filters worth simulating; see the scope note at the top. */
function applyFilters(rows: BrixDataPoint[], q: AnyQuery): BrixDataPoint[] {
  let out = rows;

  const crops = q.cropTypes as string[] | undefined;
  if (crops?.length) out = out.filter((r) => crops.includes(r.cropType) || crops.includes(r.cropId));

  const brand = q.brand as string | undefined;
  if (brand) out = out.filter((r) => (r.brandLabel ?? r.brandName) === brand);

  const place = (q.place ?? q.location) as string | undefined;
  if (place) out = out.filter((r) => r.locationName === place);

  if (q.city) out = out.filter((r) => r.city === q.city);
  if (q.state) out = out.filter((r) => r.state === q.state);
  if (q.country) out = out.filter((r) => r.country === q.country);

  if (q.brixMin != null) out = out.filter((r) => r.brixLevel >= (q.brixMin as number));
  if (q.brixMax != null) out = out.filter((r) => r.brixLevel <= (q.brixMax as number));
  if (q.timestamped) out = out.filter((r) => !!r.outpoint);

  const search = (q.search as string | undefined)?.trim().toLowerCase();
  if (search) {
    out = out.filter((r) =>
      [r.cropLabel, r.brandLabel, r.locationName, r.submittedBy, r.outlier_notes]
        .some((v) => (v ?? '').toLowerCase().includes(search)),
    );
  }
  return out;
}

function applySort(rows: BrixDataPoint[], q: AnyQuery): BrixDataPoint[] {
  const dir = q.sortOrder === 'asc' ? 1 : -1;
  const key = q.sortBy as string | undefined;
  const pick = (r: BrixDataPoint) =>
    key === 'brix_value' ? r.brixLevel
    : key === 'crop_name' ? (r.cropLabel ?? r.cropType)
    : key === 'place_label' ? r.locationName
    : r.submittedAt;

  return [...rows].sort((a, b) => {
    const av = pick(a), bv = pick(b);
    if (av === bv) return 0;
    return (av > bv ? 1 : -1) * dir;
  });
}

/** The dev user's id, matching devAuth's makeDevUser. */
const DEV_USER_ID = 'dev-user-0000-0000-0000-000000000000';

const scoped = (rows: BrixDataPoint[], scope?: string) =>
  scope === 'mine' ? rows.filter((r) => r.userId === DEV_USER_ID) : rows;

export function mockSubmissionsPage(q: AnyQuery, scope?: string): BrixDataPoint[] {
  const rows = applySort(applyFilters(scoped(dataset(), scope), q), q);
  const offset = (q.offset as number) ?? 0;
  const limit = (q.limit as number) ?? 50;
  return rows.slice(offset, offset + limit);
}

export function mockSubmissionsCount(q: AnyQuery, scope?: string): number {
  return applyFilters(scoped(dataset(), scope), q).length;
}

// ── Leaderboards ────────────────────────────────────────────────────────────

type MockLeaderboardEntry = Record<string, unknown> & {
  submission_count: number;
  rank: number;
};

/** Ranks the mock readings by average score, grouped by the given board key. */
function rankBy(
  rows0: BrixDataPoint[],
  group: (r: BrixDataPoint) => { id: string; name: string; street?: string; city?: string; state?: string },
  fields: (g: { id: string; name: string; street?: string; city?: string; state?: string }) => Record<string, unknown>,
): MockLeaderboardEntry[] {
  const buckets = new Map<string, { g: ReturnType<typeof group>; rows: BrixDataPoint[] }>();
  for (const r of rows0) {
    const g = group(r);
    if (!buckets.has(g.id)) buckets.set(g.id, { g, rows: [] });
    buckets.get(g.id)!.rows.push(r);
  }

  return [...buckets.values()]
    .map(({ g, rows }) => {
      const avgBrix = rows.reduce((s, r) => s + r.brixLevel, 0) / rows.length;
      // Position within the crop's own poor..excellent band, matching how the
      // real boards express a crop-relative rating rather than raw BRIX.
      const avgNorm =
        rows.reduce((s, r) => {
          const poor = r.poorBrix ?? 0;
          const excellent = r.excellentBrix ?? 1;
          const span = Math.max(excellent - poor, 0.001);
          return s + Math.min(Math.max((r.brixLevel - poor) / span, 0), 1) * 3;
        }, 0) / rows.length;

      return {
        ...fields(g),
        submission_count: rows.length,
        average_brix: Math.round(avgBrix * 10) / 10,
        average_normalized_score: Math.round(avgNorm * 100) / 100,
        rank: 0,
      } satisfies MockLeaderboardEntry;
    })
    .sort((a, b) => (b.average_normalized_score as number) - (a.average_normalized_score as number))
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

/** Board filters, so changing crop/place/area visibly re-ranks the mock data. */
export interface MockBoardFilters {
  country?: string;
  state?: string;
  city?: string;
  crop?: string;
  store?: string;
}

const ALL_COUNTRIES_SENTINEL = 'All Countries';

function boardRows(f: MockBoardFilters = {}): BrixDataPoint[] {
  return dataset().filter((r) => {
    if (f.crop && r.cropType !== f.crop) return false;
    if (f.store && r.locationName !== f.store) return false;
    if (f.city && r.city !== f.city) return false;
    if (f.state && r.state !== f.state) return false;
    if (f.country && f.country !== ALL_COUNTRIES_SENTINEL && r.country !== f.country) return false;
    return true;
  });
}

export function mockLocationLeaderboard(f: MockBoardFilters = {}): MockLeaderboardEntry[] {
  return rankBy(
    boardRows(f),
    (r) => ({ id: r.placeId, name: r.locationName, street: r.streetAddress, city: r.city, state: r.state }),
    (g) => ({ location_id: g.id, location_name: g.name, location_label: g.name, street_address: g.street, city: g.city, state: g.state }),
  );
}

export function mockBrandLeaderboard(f: MockBoardFilters = {}): MockLeaderboardEntry[] {
  return rankBy(
    boardRows(f),
    (r) => ({ id: r.brandId, name: r.brandLabel ?? r.brandName }),
    (g) => ({ brand_id: g.id, brand_name: g.name, brand_label: g.name }),
  );
}

export function mockUserLeaderboard(f: MockBoardFilters = {}): MockLeaderboardEntry[] {
  // The user board ranks by volume, not score.
  return rankBy(
    boardRows(f),
    (r) => ({ id: r.submittedBy, name: r.submittedBy }),
    (g) => ({ user_id: g.id, user_name: g.name, display_name: g.name, entity_name: g.name }),
  )
    .sort((a, b) => b.submission_count - a.submission_count)
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

// ── "Mine" stats, so Profile agrees with the browser's Mine scope ───────────

const mineRows = () => dataset().filter((r) => r.userId === DEV_USER_ID);

export function mockMineCount(verified?: boolean): number {
  const rows = mineRows();
  return verified === undefined ? rows.length : rows.filter((r) => r.verified === verified).length;
}

export function mockMineCropIds(): string[] {
  return [...new Set(mineRows().map((r) => r.cropId))];
}

export function mockMineVenueIds(): string[] {
  return [...new Set(mineRows().map((r) => r.placeId))];
}

/** Single reading by id, for the reading detail route. */
export function mockSubmissionById(id: string): BrixDataPoint | null {
  return dataset().find((r) => r.id === id) ?? null;
}

/** Crop / brand / place lists, so the filter dropdowns and search starters
 *  have something to offer in dev. Derived from the same readings. */
export function mockStaticData() {
  const uniq = <T extends { id: string }>(xs: T[]) =>
    [...new Map(xs.map((x) => [x.id, x])).values()];

  return {
    crops: uniq(CROPS.map((c) => ({ id: c.id, name: c.name, label: c.label }))),
    brands: uniq(BRANDS.map((b) => ({ id: b.id, name: b.name, label: b.label }))),
    locations: uniq(PLACES.map((p) => ({ id: p.id, name: p.name, label: p.name }))),
  };
}

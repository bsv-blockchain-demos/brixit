import { describe, it, expect } from 'vitest';
import { applyFilters, getFilterSummary } from '../filterUtils';
import { DEFAULT_MAP_FILTERS } from '../../contexts/FilterContext';
import type { BrixDataPoint, MapFilter } from '../../types';

// ---------------------------------------------------------------------------
// Helper — builds a fully-populated BrixDataPoint with sensible defaults
// ---------------------------------------------------------------------------
function makePoint(overrides: Partial<BrixDataPoint> = {}): BrixDataPoint {
  return {
    id: '1',
    brixLevel: 12,
    verified: true,
    verifiedAt: null,
    variety: '',
    cropType: 'Apple',
    category: 'Fruit',
    latitude: 30.0,
    longitude: -97.0,
    locationName: 'Whole Foods',
    placeName: '123 Main St',
    streetAddress: '123 Main St',
    city: 'Austin',
    state: 'TX',
    country: 'USA',
    brandName: 'Organic Valley',
    submittedBy: 'Alice',
    userId: 'u1',
    verifiedBy: 'admin',
    submittedAt: '2024-06-15T12:00:00.000Z',
    outlier_notes: '',
    images: [],
    poorBrix: 4,
    averageBrix: 8,
    goodBrix: 12,
    excellentBrix: 16,
    purchaseDate: null,
    cropId: 'crop-1',
    placeId: 'place-1',
    brandId: 'brand-1',
    verifiedByUserId: 'admin-1',
    cropLabel: null,
    brandLabel: null,
    ...overrides,
  };
}

/** Returns a fresh copy of the default filters so tests don't share state. */
const baseFilters = (): MapFilter => ({ ...DEFAULT_MAP_FILTERS });

// ---------------------------------------------------------------------------
// applyFilters
// ---------------------------------------------------------------------------
describe('applyFilters', () => {
  describe('verified filter', () => {
    it('non-admin always filters out unverified points', () => {
      const points = [makePoint({ verified: true }), makePoint({ verified: false })];
      expect(applyFilters(points, baseFilters(), false)).toHaveLength(1);
    });

    it('non-admin keeps verified points regardless of verifiedOnly flag', () => {
      const points = [makePoint({ verified: true })];
      expect(applyFilters(points, { ...baseFilters(), verifiedOnly: false }, false)).toHaveLength(1);
    });

    it('admin with verifiedOnly=false shows all points', () => {
      const points = [makePoint({ verified: true }), makePoint({ verified: false })];
      expect(applyFilters(points, { ...baseFilters(), verifiedOnly: false }, true)).toHaveLength(2);
    });

    it('admin with verifiedOnly=true filters out unverified', () => {
      const points = [makePoint({ verified: true }), makePoint({ verified: false })];
      expect(applyFilters(points, { ...baseFilters(), verifiedOnly: true }, true)).toHaveLength(1);
    });
  });

  describe('cropTypes filter', () => {
    it('returns all points when cropTypes is empty', () => {
      const points = [makePoint({ cropType: 'Apple' }), makePoint({ cropType: 'Carrot' })];
      expect(applyFilters(points, baseFilters(), true)).toHaveLength(2);
    });

    it('filters by a single crop type', () => {
      const points = [makePoint({ cropType: 'Apple' }), makePoint({ cropType: 'Carrot' })];
      const result = applyFilters(points, { ...baseFilters(), cropTypes: ['Apple'] }, true);
      expect(result).toHaveLength(1);
      expect(result[0].cropType).toBe('Apple');
    });

    it('filters by multiple crop types', () => {
      const points = [
        makePoint({ cropType: 'Apple' }),
        makePoint({ cropType: 'Carrot' }),
        makePoint({ cropType: 'Beet' }),
      ];
      expect(applyFilters(points, { ...baseFilters(), cropTypes: ['Apple', 'Beet'] }, true)).toHaveLength(2);
    });

    it('excludes points not in the list', () => {
      const points = [makePoint({ cropType: 'Apple' })];
      expect(applyFilters(points, { ...baseFilters(), cropTypes: ['Carrot'] }, true)).toHaveLength(0);
    });
  });

  describe('category filter', () => {
    it('returns all points when category is the default (empty string)', () => {
      const points = [makePoint({ category: 'Fruit' }), makePoint({ category: 'Vegetable' })];
      expect(applyFilters(points, baseFilters(), true)).toHaveLength(2);
    });

    it('filters by category', () => {
      const points = [makePoint({ category: 'Fruit' }), makePoint({ category: 'Vegetable' })];
      const result = applyFilters(points, { ...baseFilters(), category: 'Fruit' }, true);
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('Fruit');
    });
  });

  describe('brand filter', () => {
    it('does not filter when brand is the default (empty string)', () => {
      const points = [makePoint({ brandName: 'Organic Valley' })];
      expect(applyFilters(points, baseFilters(), true)).toHaveLength(1);
    });

    it('filters by partial brand name (case-insensitive)', () => {
      const points = [makePoint({ brandName: 'Organic Valley' }), makePoint({ brandName: 'Happy Farms' })];
      const result = applyFilters(points, { ...baseFilters(), brand: 'organic' }, true);
      expect(result).toHaveLength(1);
      expect(result[0].brandName).toBe('Organic Valley');
    });

    it('excludes points with no brand name when brand filter is active', () => {
      const points = [makePoint({ brandName: '' })];
      expect(applyFilters(points, { ...baseFilters(), brand: 'organic' }, true)).toHaveLength(0);
    });
  });

  describe('place filter', () => {
    it('matches against locationName (partial, case-insensitive)', () => {
      const points = [
        makePoint({ locationName: 'Whole Foods', placeName: '123 Main' }),
        makePoint({ locationName: 'Walmart', placeName: '456 Oak' }),
      ];
      const result = applyFilters(points, { ...baseFilters(), place: 'whole' }, true);
      expect(result).toHaveLength(1);
      expect(result[0].locationName).toBe('Whole Foods');
    });

    it('matches against placeName when locationName does not match', () => {
      const points = [
        makePoint({ locationName: 'Store', placeName: '123 Main St' }),
        makePoint({ locationName: 'Store', placeName: '456 Oak Ave' }),
      ];
      const result = applyFilters(points, { ...baseFilters(), place: 'Main' }, true);
      expect(result).toHaveLength(1);
    });
  });

  describe('brixRange filter', () => {
    it('returns all points when range equals the default [0, 30]', () => {
      const points = [makePoint({ brixLevel: 5 }), makePoint({ brixLevel: 25 })];
      expect(applyFilters(points, baseFilters(), true)).toHaveLength(2);
    });

    it('filters points outside the custom brix range', () => {
      const points = [
        makePoint({ brixLevel: 5 }),
        makePoint({ brixLevel: 12 }),
        makePoint({ brixLevel: 20 }),
      ];
      const result = applyFilters(points, { ...baseFilters(), brixRange: [10, 15] }, true);
      expect(result).toHaveLength(1);
      expect(result[0].brixLevel).toBe(12);
    });

    it('includes boundary values', () => {
      const points = [makePoint({ brixLevel: 10 }), makePoint({ brixLevel: 15 })];
      const result = applyFilters(points, { ...baseFilters(), brixRange: [10, 15] }, true);
      expect(result).toHaveLength(2);
    });
  });

  describe('dateRange filter', () => {
    it('does not filter when dateRange is the default [empty, empty]', () => {
      const points = [makePoint({ submittedAt: '2024-01-01T00:00:00.000Z' })];
      expect(applyFilters(points, baseFilters(), true)).toHaveLength(1);
    });

    it('filters out points before the start date', () => {
      const points = [
        makePoint({ submittedAt: '2024-01-01T00:00:00.000Z' }),
        makePoint({ submittedAt: '2024-06-01T00:00:00.000Z' }),
      ];
      const result = applyFilters(points, { ...baseFilters(), dateRange: ['2024-03-01', ''] }, true);
      expect(result).toHaveLength(1);
      expect(result[0].submittedAt).toContain('2024-06');
    });

    it('filters out points after the end date', () => {
      const points = [
        makePoint({ submittedAt: '2024-01-01T00:00:00.000Z' }),
        makePoint({ submittedAt: '2024-12-01T00:00:00.000Z' }),
      ];
      const result = applyFilters(points, { ...baseFilters(), dateRange: ['', '2024-06-01'] }, true);
      expect(result).toHaveLength(1);
      expect(result[0].submittedAt).toContain('2024-01');
    });

    it('includes points on the start date', () => {
      const points = [makePoint({ submittedAt: '2024-03-01T00:00:00.000Z' })];
      expect(applyFilters(points, { ...baseFilters(), dateRange: ['2024-03-01', ''] }, true)).toHaveLength(1);
    });

    it('includes points at 23:59:59 UTC on the end date', () => {
      const points = [makePoint({ submittedAt: '2024-06-01T23:59:59.000Z' })];
      expect(applyFilters(points, { ...baseFilters(), dateRange: ['', '2024-06-01'] }, true)).toHaveLength(1);
    });

    it('excludes points at midnight UTC on the day after the end date', () => {
      const points = [makePoint({ submittedAt: '2024-06-02T00:00:00.000Z' })];
      expect(applyFilters(points, { ...baseFilters(), dateRange: ['', '2024-06-01'] }, true)).toHaveLength(0);
    });
  });

  describe('hasImage filter', () => {
    it('does not filter when hasImage is false (default)', () => {
      const points = [makePoint({ images: [] }), makePoint({ images: ['img.jpg'] })];
      expect(applyFilters(points, baseFilters(), true)).toHaveLength(2);
    });

    it('filters out points with no images when hasImage is true', () => {
      const points = [makePoint({ images: [] }), makePoint({ images: ['img.jpg'] })];
      const result = applyFilters(points, { ...baseFilters(), hasImage: true }, true);
      expect(result).toHaveLength(1);
      expect(result[0].images).toHaveLength(1);
    });
  });

  describe('submittedBy filter', () => {
    it('filters by partial submitter name (case-insensitive)', () => {
      const points = [makePoint({ submittedBy: 'Alice' }), makePoint({ submittedBy: 'Bob' })];
      const result = applyFilters(points, { ...baseFilters(), submittedBy: 'ali' }, true);
      expect(result).toHaveLength(1);
      expect(result[0].submittedBy).toBe('Alice');
    });
  });

  describe('geographic filters', () => {
    it('filters by city (case-insensitive exact match)', () => {
      const points = [makePoint({ city: 'Austin' }), makePoint({ city: 'Dallas' })];
      const result = applyFilters(points, { ...baseFilters(), city: 'austin' }, true);
      expect(result).toHaveLength(1);
      expect(result[0].city).toBe('Austin');
    });

    it('filters by state', () => {
      const points = [makePoint({ state: 'TX' }), makePoint({ state: 'CA' })];
      const result = applyFilters(points, { ...baseFilters(), state: 'TX' }, true);
      expect(result).toHaveLength(1);
    });

    it('filters by country', () => {
      const points = [makePoint({ country: 'USA' }), makePoint({ country: 'Canada' })];
      const result = applyFilters(points, { ...baseFilters(), country: 'Canada' }, true);
      expect(result).toHaveLength(1);
    });
  });

  describe('empty and edge cases', () => {
    it('returns empty array for empty input', () => {
      expect(applyFilters([], baseFilters(), true)).toHaveLength(0);
    });

    it('returns empty array when no points match combined filters', () => {
      const points = [makePoint({ cropType: 'Apple' })];
      expect(applyFilters(points, { ...baseFilters(), cropTypes: ['Carrot'] }, true)).toHaveLength(0);
    });

    it('applies multiple active filters together (AND logic)', () => {
      const points = [
        makePoint({ cropType: 'Apple', brixLevel: 12, city: 'Austin' }),
        makePoint({ cropType: 'Apple', brixLevel: 5, city: 'Austin' }),  // fails brixRange
        makePoint({ cropType: 'Carrot', brixLevel: 12, city: 'Austin' }), // fails cropType
      ];
      const result = applyFilters(
        points,
        { ...baseFilters(), cropTypes: ['Apple'], brixRange: [10, 15], city: 'Austin' },
        true
      );
      expect(result).toHaveLength(1);
      expect(result[0].cropType).toBe('Apple');
      expect(result[0].brixLevel).toBe(12);
    });
  });
});

// ---------------------------------------------------------------------------
// getFilterSummary
// ---------------------------------------------------------------------------
describe('getFilterSummary', () => {
  it('returns "No active filters" for default filters as admin', () => {
    expect(getFilterSummary(baseFilters(), true)).toBe('No active filters');
  });

  it('always includes "verified only" note for non-admin users', () => {
    // Non-admin always has verified-only enforced, so it always appears
    expect(getFilterSummary(baseFilters(), false)).toContain('Verified only');
  });

  it('reports the verified filter when admin sets it to false', () => {
    // Default is true; changing to false is a meaningful admin action
    const result = getFilterSummary({ ...baseFilters(), verifiedOnly: false }, true);
    expect(result).toContain('verified: any');
  });

  it('does NOT report verified filter when admin keeps the default (true)', () => {
    const result = getFilterSummary({ ...baseFilters(), verifiedOnly: true }, true);
    expect(result).not.toContain('verified');
  });

  it('reports crop types count', () => {
    const result = getFilterSummary({ ...baseFilters(), cropTypes: ['Apple', 'Carrot'] }, true);
    expect(result).toContain('2 crop types');
  });

  it('uses singular "crop type" for a single selection', () => {
    const result = getFilterSummary({ ...baseFilters(), cropTypes: ['Apple'] }, true);
    expect(result).toContain('1 crop type');
    expect(result).not.toContain('crop types');
  });

  it('reports brand filter', () => {
    const result = getFilterSummary({ ...baseFilters(), brand: 'Organic' }, true);
    expect(result).toContain('Brand/Farm: Organic');
  });

  it('reports place filter', () => {
    const result = getFilterSummary({ ...baseFilters(), place: 'Whole Foods' }, true);
    expect(result).toContain('Point of Purchase: Whole Foods');
  });

  it('reports brix range when non-default', () => {
    const result = getFilterSummary({ ...baseFilters(), brixRange: [5, 15] }, true);
    expect(result).toContain('BRIX: 5.0-15.0');
  });

  it('does NOT report brix range when at the default [0, 30]', () => {
    expect(getFilterSummary(baseFilters(), true)).not.toContain('BRIX');
  });

  it('reports date range when start is set', () => {
    const result = getFilterSummary({ ...baseFilters(), dateRange: ['2024-01-01', ''] }, true);
    expect(result).toContain('dates:');
  });

  it('reports image filter when active', () => {
    const result = getFilterSummary({ ...baseFilters(), hasImage: true }, true);
    expect(result).toContain('with images');
  });

  it('reports submittedBy filter', () => {
    const result = getFilterSummary({ ...baseFilters(), submittedBy: 'Alice' }, true);
    expect(result).toContain('by: Alice');
  });

  it('reports geographic location as a combined string', () => {
    const result = getFilterSummary({ ...baseFilters(), city: 'Austin', state: 'TX', country: 'USA' }, true);
    expect(result).toContain('location:');
    expect(result).toContain('Austin');
    expect(result).toContain('TX');
    expect(result).toContain('USA');
  });

  it('combines multiple active filters with comma separator', () => {
    const result = getFilterSummary(
      { ...baseFilters(), brand: 'Organic', cropTypes: ['Apple'] },
      true
    );
    expect(result).toContain(',');
  });
});

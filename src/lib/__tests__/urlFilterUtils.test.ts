import { describe, it, expect } from 'vitest';
import { parseURLSearchParams, createURLSearchParams, mergeFiltersWithDefaults } from '../urlFilterUtils';
import { DEFAULT_MAP_FILTERS } from '../../contexts/FilterContext';

// ---------------------------------------------------------------------------
// parseURLSearchParams
// ---------------------------------------------------------------------------
describe('parseURLSearchParams', () => {
  it('returns an empty object for empty params', () => {
    expect(parseURLSearchParams(new URLSearchParams())).toEqual({});
  });

  it('parses a single crop type', () => {
    expect(parseURLSearchParams(new URLSearchParams('crop=Apple')).cropTypes).toEqual(['Apple']);
  });

  it('parses multiple comma-separated crop types', () => {
    expect(parseURLSearchParams(new URLSearchParams('crop=Apple,Carrot,Beet')).cropTypes)
      .toEqual(['Apple', 'Carrot', 'Beet']);
  });

  it('trims whitespace from each crop type', () => {
    expect(parseURLSearchParams(new URLSearchParams('crop=Apple , Carrot')).cropTypes)
      .toEqual(['Apple', 'Carrot']);
  });

  it('filters out empty segments from a crop list', () => {
    expect(parseURLSearchParams(new URLSearchParams('crop=Apple,,Carrot')).cropTypes)
      .toEqual(['Apple', 'Carrot']);
  });

  it('parses brand', () => {
    const r = parseURLSearchParams(new URLSearchParams('brand=Organic+Valley'));
    expect(r.brand).toBe('Organic Valley');
  });

  it('parses place', () => {
    const r = parseURLSearchParams(new URLSearchParams('place=Whole+Foods'));
    expect(r.place).toBe('Whole Foods');
  });

  it('parses category', () => {
    const r = parseURLSearchParams(new URLSearchParams('category=Fruit'));
    expect(r.category).toBe('Fruit');
  });

  it('parses submittedBy', () => {
    const r = parseURLSearchParams(new URLSearchParams('submittedBy=Alice'));
    expect(r.submittedBy).toBe('Alice');
  });

  it('uses location as place when place is not explicitly set', () => {
    const r = parseURLSearchParams(new URLSearchParams('location=Whole+Foods'));
    expect(r.place).toBe('Whole Foods');
    expect(r.location).toBe('Whole Foods');
  });

  it('does NOT override an explicit place with location', () => {
    const r = parseURLSearchParams(new URLSearchParams('place=Farmers+Market&location=Whole+Foods'));
    expect(r.place).toBe('Farmers Market');
  });

  it('parses individual geographic components', () => {
    const r = parseURLSearchParams(new URLSearchParams('city=Austin&state=TX&country=USA'));
    expect(r.city).toBe('Austin');
    expect(r.state).toBe('TX');
    expect(r.country).toBe('USA');
  });

  it('parses a valid brix range', () => {
    expect(parseURLSearchParams(new URLSearchParams('brixMin=5&brixMax=15')).brixRange)
      .toEqual([5, 15]);
  });

  it('ignores brix range when values are not numeric', () => {
    expect(parseURLSearchParams(new URLSearchParams('brixMin=abc&brixMax=def')).brixRange)
      .toBeUndefined();
  });

  it('ignores brix range when only one bound is provided', () => {
    expect(parseURLSearchParams(new URLSearchParams('brixMin=5')).brixRange)
      .toBeUndefined();
  });

  it('ignores brix range when only brixMax is provided', () => {
    expect(parseURLSearchParams(new URLSearchParams('brixMax=15')).brixRange)
      .toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// createURLSearchParams
// ---------------------------------------------------------------------------
describe('createURLSearchParams', () => {
  it('returns empty params for an empty filter object', () => {
    expect(createURLSearchParams({}).toString()).toBe('');
  });

  it('includes non-empty string values', () => {
    const params = createURLSearchParams({ country: 'USA', crop: 'Apple' });
    expect(params.get('country')).toBe('USA');
    expect(params.get('crop')).toBe('Apple');
  });

  it('omits empty-string values', () => {
    const params = createURLSearchParams({ country: '', state: 'TX' });
    expect(params.has('country')).toBe(false);
    expect(params.get('state')).toBe('TX');
  });

  it('omits whitespace-only values', () => {
    const params = createURLSearchParams({ country: '   ' });
    expect(params.has('country')).toBe(false);
  });

  it('includes all provided non-empty values', () => {
    const params = createURLSearchParams({ city: 'Austin', state: 'TX', country: 'USA' });
    expect(params.get('city')).toBe('Austin');
    expect(params.get('state')).toBe('TX');
    expect(params.get('country')).toBe('USA');
  });
});

// ---------------------------------------------------------------------------
// mergeFiltersWithDefaults
// ---------------------------------------------------------------------------
describe('mergeFiltersWithDefaults', () => {
  it('returns the full default filters when no url filters are provided', () => {
    expect(mergeFiltersWithDefaults({})).toEqual(DEFAULT_MAP_FILTERS);
  });

  it('overrides cropTypes from url filters', () => {
    const result = mergeFiltersWithDefaults({ cropTypes: ['Apple'] });
    expect(result.cropTypes).toEqual(['Apple']);
  });

  it('overrides brixRange from url filters', () => {
    const result = mergeFiltersWithDefaults({ brixRange: [5, 20] });
    expect(result.brixRange).toEqual([5, 20]);
  });

  it('preserves defaults for fields not supplied in url filters', () => {
    const result = mergeFiltersWithDefaults({ city: 'Austin' });
    expect(result.verifiedOnly).toBe(DEFAULT_MAP_FILTERS.verifiedOnly);
    expect(result.brixRange).toEqual(DEFAULT_MAP_FILTERS.brixRange);
    expect(result.cropTypes).toEqual(DEFAULT_MAP_FILTERS.cropTypes);
  });

  it('falls back to empty string for city when not in url', () => {
    expect(mergeFiltersWithDefaults({}).city).toBe('');
  });

  it('falls back to empty string for state when not in url', () => {
    expect(mergeFiltersWithDefaults({}).state).toBe('');
  });

  it('falls back to empty string for country when not in url', () => {
    expect(mergeFiltersWithDefaults({}).country).toBe('');
  });

  it('uses the provided city value over the default', () => {
    expect(mergeFiltersWithDefaults({ city: 'Austin' }).city).toBe('Austin');
  });
});

import { describe, it, expect } from 'vitest';
import { buildSubmissionFilters } from '../buildSubmissionFilters.js';

describe('buildSubmissionFilters', () => {
  describe('base clause', () => {
    it('pins verified: true with no filters', () => {
      expect(buildSubmissionFilters({})).toEqual({ verified: true });
    });

    it('keeps verified: true alongside other filters', () => {
      const w = buildSubmissionFilters({ category: 'fruit' });
      expect(w.verified).toBe(true);
    });
  });

  describe('cropTypes', () => {
    it('splits comma-separated list into an `in` clause', () => {
      expect(buildSubmissionFilters({ cropTypes: 'apple,banana,kale' }).crop)
        .toEqual({ name: { in: ['apple', 'banana', 'kale'] } });
    });

    it('trims whitespace and drops empty entries', () => {
      expect(buildSubmissionFilters({ cropTypes: 'apple, ,banana,' }).crop)
        .toEqual({ name: { in: ['apple', 'banana'] } });
    });

    it('merges with category into the same `crop` object', () => {
      const w = buildSubmissionFilters({ cropTypes: 'apple', category: 'fruit' });
      expect(w.crop).toEqual({ name: { in: ['apple'] }, category: 'fruit' });
    });

    it('omits the clause when value is empty', () => {
      expect(buildSubmissionFilters({ cropTypes: '' }).crop).toBeUndefined();
    });
  });

  describe('venue filters', () => {
    it('merges city/state/country into a single `venue` object', () => {
      const w = buildSubmissionFilters({ city: 'Zurich', state: 'ZH', country: 'CH' });
      expect(w.venue).toEqual({
        city: { equals: 'Zurich', mode: 'insensitive' },
        state: { equals: 'ZH', mode: 'insensitive' },
        country: { equals: 'CH', mode: 'insensitive' },
      });
    });

    it('treats `place` and `location` as the same venue-name filter', () => {
      expect(buildSubmissionFilters({ place: 'Aldi' }).venue)
        .toEqual({ name: { equals: 'Aldi', mode: 'insensitive' } });
      expect(buildSubmissionFilters({ location: 'Coop' }).venue)
        .toEqual({ name: { equals: 'Coop', mode: 'insensitive' } });
    });

    it('prefers `place` over `location` when both are present', () => {
      const w = buildSubmissionFilters({ place: 'Aldi', location: 'Coop' });
      expect(w.venue.name.equals).toBe('Aldi');
    });

    it('combines venue name with city', () => {
      const w = buildSubmissionFilters({ place: 'Aldi', city: 'Zurich' });
      expect(w.venue).toEqual({
        name: { equals: 'Aldi', mode: 'insensitive' },
        city: { equals: 'Zurich', mode: 'insensitive' },
      });
    });
  });

  describe('brand', () => {
    it('matches brand on name OR label', () => {
      expect(buildSubmissionFilters({ brand: 'Acme' }).brand).toEqual({
        OR: [
          { name: { equals: 'Acme', mode: 'insensitive' } },
          { label: { equals: 'Acme', mode: 'insensitive' } },
        ],
      });
    });
  });

  describe('brix range', () => {
    it('applies brixMin as gte', () => {
      expect(buildSubmissionFilters({ brixMin: '10' }).brixValue).toEqual({ gte: 10 });
    });

    it('applies brixMax as lte', () => {
      expect(buildSubmissionFilters({ brixMax: '20' }).brixValue).toEqual({ lte: 20 });
    });

    it('merges brixMin and brixMax into a single range', () => {
      expect(buildSubmissionFilters({ brixMin: '10', brixMax: '20' }).brixValue)
        .toEqual({ gte: 10, lte: 20 });
    });

    it('accepts decimal values', () => {
      expect(buildSubmissionFilters({ brixMin: '12.5' }).brixValue).toEqual({ gte: 12.5 });
    });

    it('ignores non-numeric values', () => {
      expect(buildSubmissionFilters({ brixMin: 'abc' }).brixValue).toBeUndefined();
    });

    it('ignores empty string', () => {
      expect(buildSubmissionFilters({ brixMin: '' }).brixValue).toBeUndefined();
    });
  });

  describe('date range', () => {
    it('parses dateStart as gte', () => {
      const w = buildSubmissionFilters({ dateStart: '2026-01-01' });
      expect(w.assessmentDate.gte).toBeInstanceOf(Date);
      expect((w.assessmentDate.gte as Date).toISOString().startsWith('2026-01-01')).toBe(true);
    });

    it('parses dateEnd as lte', () => {
      const w = buildSubmissionFilters({ dateEnd: '2026-12-31' });
      expect(w.assessmentDate.lte).toBeInstanceOf(Date);
    });

    it('combines start and end into a single range', () => {
      const w = buildSubmissionFilters({ dateStart: '2026-01-01', dateEnd: '2026-12-31' });
      expect(w.assessmentDate.gte).toBeInstanceOf(Date);
      expect(w.assessmentDate.lte).toBeInstanceOf(Date);
    });

    it('ignores malformed date strings', () => {
      expect(buildSubmissionFilters({ dateStart: 'not-a-date' }).assessmentDate).toBeUndefined();
    });
  });

  describe('search', () => {
    it('expands into an OR across crop/brand/venue/notes fields', () => {
      const w = buildSubmissionFilters({ search: 'tomato' });
      expect(w.OR).toHaveLength(6);
      expect(w.OR).toEqual(
        expect.arrayContaining([
          { crop:   { name:  { contains: 'tomato', mode: 'insensitive' } } },
          { crop:   { label: { contains: 'tomato', mode: 'insensitive' } } },
          { brand:  { name:  { contains: 'tomato', mode: 'insensitive' } } },
          { brand:  { label: { contains: 'tomato', mode: 'insensitive' } } },
          { venue:  { name:  { contains: 'tomato', mode: 'insensitive' } } },
          { outlierNotes: { contains: 'tomato', mode: 'insensitive' } },
        ]),
      );
    });

    it('trims whitespace from the search term', () => {
      const w = buildSubmissionFilters({ search: '  tomato  ' });
      expect(w.OR[0].crop.name.contains).toBe('tomato');
    });

    it('omits the clause when search is whitespace only', () => {
      expect(buildSubmissionFilters({ search: '   ' }).OR).toBeUndefined();
    });
  });

  describe('list/count parity', () => {
    // Regression: prior to extraction, /count was missing search, dateStart,
    // dateEnd — meaning a filtered query returned the right rows but the wrong
    // total. A single filter builder now guarantees these stay in sync.
    it('applies search to the same clause used by /count', () => {
      const w = buildSubmissionFilters({ search: 'apple' });
      expect(w.OR).toBeDefined();
    });

    it('applies dateStart/dateEnd to the same clause used by /count', () => {
      const w = buildSubmissionFilters({ dateStart: '2026-01-01', dateEnd: '2026-06-01' });
      expect(w.assessmentDate).toBeDefined();
    });
  });

  describe('combined filters', () => {
    it('builds a fully populated clause without dropping fields', () => {
      const w = buildSubmissionFilters({
        cropTypes: 'apple,banana',
        category: 'fruit',
        city: 'Zurich',
        country: 'CH',
        place: 'Aldi',
        brand: 'Acme',
        brixMin: '8',
        brixMax: '22',
        dateStart: '2026-01-01',
        dateEnd: '2026-12-31',
        search: 'organic',
      });
      expect(w.verified).toBe(true);
      expect(w.crop.name.in).toEqual(['apple', 'banana']);
      expect(w.crop.category).toBe('fruit');
      expect(w.venue.city.equals).toBe('Zurich');
      expect(w.venue.country.equals).toBe('CH');
      expect(w.venue.name.equals).toBe('Aldi');
      expect(w.brand.OR).toHaveLength(2);
      expect(w.brixValue).toEqual({ gte: 8, lte: 22 });
      expect(w.assessmentDate.gte).toBeInstanceOf(Date);
      expect(w.assessmentDate.lte).toBeInstanceOf(Date);
      expect(w.OR).toHaveLength(6);
    });
  });
});

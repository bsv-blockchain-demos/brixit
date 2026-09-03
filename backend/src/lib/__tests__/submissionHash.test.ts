import { describe, it, expect } from 'vitest';
import { submissionHash, type HashableSubmission } from '../submissionHash.js';

const base: HashableSubmission = {
  cropId: 'crop-1',
  brandId: 'brand-1',
  venueId: 'venue-1',
  brixValue: 14,
  cropVariety: 'Honeycrisp',
  assessmentDate: new Date('2026-05-01T09:30:00Z'),
  purchaseDate: new Date('2026-04-28T00:00:00Z'),
  outlierNotes: 'picked ripe',
};

describe('submissionHash', () => {
  it('returns a 64-character lowercase hex digest', () => {
    expect(submissionHash(base)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is stable for the same input', () => {
    expect(submissionHash(base)).toBe(submissionHash({ ...base }));
  });

  it('ignores object key order', () => {
    const reordered: HashableSubmission = {
      outlierNotes: base.outlierNotes,
      purchaseDate: base.purchaseDate,
      assessmentDate: base.assessmentDate,
      cropVariety: base.cropVariety,
      brixValue: base.brixValue,
      venueId: base.venueId,
      brandId: base.brandId,
      cropId: base.cropId,
    };
    expect(submissionHash(reordered)).toBe(submissionHash(base));
  });

  it.each([
    ['cropId', { cropId: 'crop-2' }],
    ['brandId', { brandId: 'brand-2' }],
    ['venueId', { venueId: 'venue-2' }],
    ['brixValue', { brixValue: 15 }],
    ['cropVariety', { cropVariety: 'Gala' }],
    ['assessmentDate', { assessmentDate: new Date('2026-05-02T09:30:00Z') }],
    ['purchaseDate', { purchaseDate: new Date('2026-04-29T00:00:00Z') }],
    ['outlierNotes', { outlierNotes: 'picked early' }],
  ])('changes when %s changes', (_field, patch) => {
    expect(submissionHash({ ...base, ...patch })).not.toBe(submissionHash(base));
  });

  it('treats null and undefined alike', () => {
    const withNull = { ...base, cropVariety: null, outlierNotes: null };
    const withUndefined = { ...base, cropVariety: undefined, outlierNotes: undefined } as unknown as HashableSubmission;
    expect(submissionHash(withUndefined)).toBe(submissionHash(withNull));
  });

  it('treats 14.00 and 14 as the same value', () => {
    expect(submissionHash({ ...base, brixValue: '14.00' })).toBe(
      submissionHash({ ...base, brixValue: 14 }),
    );
  });

  it('ignores the time of day on dates', () => {
    expect(submissionHash({ ...base, assessmentDate: new Date('2026-05-01T23:00:00Z') })).toBe(
      submissionHash({ ...base, assessmentDate: new Date('2026-05-01T00:00:00Z') }),
    );
  });

  // A printable delimiter would let a value containing it forge a field boundary,
  // so these two distinct rows must not collide.
  it('does not collide when a value contains spaces or pipes', () => {
    const split: HashableSubmission = { ...base, cropId: 'x', brandId: 'y' };
    const joinedSpace: HashableSubmission = { ...base, cropId: 'x y', brandId: '' };
    const joinedPipe: HashableSubmission = { ...base, cropId: 'x|y', brandId: '' };
    expect(submissionHash(split)).not.toBe(submissionHash(joinedSpace));
    expect(submissionHash(split)).not.toBe(submissionHash(joinedPipe));
  });

  it('does not collide two different unparseable brix values', () => {
    expect(submissionHash({ ...base, brixValue: 'abc' })).not.toBe(
      submissionHash({ ...base, brixValue: 'xyz' }),
    );
  });

  it('does not treat an unparseable brix value as absent', () => {
    expect(submissionHash({ ...base, brixValue: 'abc' })).not.toBe(
      submissionHash({ ...base, brixValue: null }),
    );
  });

  it('does not collide two different unparseable dates', () => {
    expect(submissionHash({ ...base, purchaseDate: 'not-a-date' })).not.toBe(
      submissionHash({ ...base, purchaseDate: 'also-not-a-date' }),
    );
  });

  it('treats an empty string as absent for numbers and dates', () => {
    expect(submissionHash({ ...base, brixValue: '', purchaseDate: '' })).toBe(
      submissionHash({ ...base, brixValue: null, purchaseDate: null }),
    );
  });
});

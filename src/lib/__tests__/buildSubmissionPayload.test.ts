import { describe, it, expect } from 'vitest';
import { buildSubmissionPayload, type SubmissionPayloadFields } from '../buildSubmissionPayload';

const base: SubmissionPayloadFields = {
  cropName: 'Tomato',
  brixValue: 12.5,
  brandName: 'Acme',
  notes: 'ripe',
  assessmentDate: '2026-06-23T00:00:00.000Z',
  purchaseDate: '2026-06-20T00:00:00.000Z',
  latitude: 1.23,
  longitude: 4.56,
  locationName: 'Market',
};

describe('buildSubmissionPayload', () => {
  it('returns exactly the nine signed fields', () => {
    expect(buildSubmissionPayload(base)).toEqual({
      cropName: 'Tomato',
      brixValue: 12.5,
      brandName: 'Acme',
      notes: 'ripe',
      assessmentDate: '2026-06-23T00:00:00.000Z',
      purchaseDate: '2026-06-20T00:00:00.000Z',
      latitude: 1.23,
      longitude: 4.56,
      locationName: 'Market',
    });
  });

  it('rounds brixValue to 2 decimals so submit and retry agree', () => {
    expect(buildSubmissionPayload({ ...base, brixValue: 12.567 }).brixValue).toBe(12.57);
    expect(buildSubmissionPayload({ ...base, brixValue: 12 }).brixValue).toBe(12);
    expect(buildSubmissionPayload({ ...base, brixValue: 12.5 }).brixValue).toBe(12.5);
  });

  it('coerces empty/undefined optional strings to null', () => {
    const payload = buildSubmissionPayload({
      ...base,
      brandName: '',
      notes: undefined,
      purchaseDate: '',
      locationName: undefined,
    });
    expect(payload).toMatchObject({
      brandName: null,
      notes: null,
      purchaseDate: null,
      locationName: null,
    });
  });

  it('preserves explicit nulls and pass-through numeric coordinates', () => {
    const payload = buildSubmissionPayload({
      ...base,
      brandName: null,
      notes: null,
      purchaseDate: null,
      latitude: null,
      longitude: null,
      locationName: null,
    });
    expect(payload).toEqual({
      cropName: 'Tomato',
      brixValue: 12.5,
      brandName: null,
      notes: null,
      assessmentDate: '2026-06-23T00:00:00.000Z',
      purchaseDate: null,
      latitude: null,
      longitude: null,
      locationName: null,
    });
  });
});

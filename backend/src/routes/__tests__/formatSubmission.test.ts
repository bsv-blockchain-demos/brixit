/**
 * Pins the public submission payload: PII stays off it, and photo keys reach
 * only the submitter and admins while the count reaches everyone.
 */
import { describe, it, expect } from 'vitest';
import {
  formatPublicSubmission,
  formatFullSubmission,
  canSeePrivateFields,
} from '../submissions.js';

const row = {
  id: 'sub-1',
  userId: 'u1',
  assessmentDate: new Date('2026-05-01T00:00:00Z'),
  brixValue: '19.2',
  verified: true,
  verifiedAt: new Date('2026-05-02T00:00:00Z'),
  cropVariety: 'Honeycrisp',
  outlierNotes: null,
  purchaseDate: null,
  skipVenuePrompt: false,
  outpoint: 'abc.0',
  rejectedAt: new Date('2026-05-03T00:00:00Z'),
  rejectionMessage: 'BRIX value reading too high for this crop',
  rejectionHash: 'deadbeef',
  crop: { id: 'c1', name: 'apple', label: 'Apple', poorBrix: '6', averageBrix: '10', goodBrix: '14', excellentBrix: '18', category: 'fruit' },
  brand: { id: 'b1', name: 'acme', label: 'Acme' },
  venue: { id: 'v1', name: 'Market', posType: 'store', latitude: 1, longitude: 2, streetAddress: '1 St', city: 'Town', state: 'ST', country: 'US' },
  user: { id: 'u1', displayName: 'Ada' },
  verifier: { id: 'u2', displayName: 'Admin' },
  images: [
    { imageUrl: 'submission-images/sub-1/1-a.jpg' },
    { imageUrl: 'submission-images/sub-1/2-b.jpg' },
  ],
};

describe('formatPublicSubmission', () => {
  it('maps image rows to a flat array of S3 keys for a privileged viewer', () => {
    expect(formatPublicSubmission(row, true).images).toEqual([
      'submission-images/sub-1/1-a.jpg',
      'submission-images/sub-1/2-b.jpg',
    ]);
  });

  it('withholds the image keys from everyone else', () => {
    expect(formatPublicSubmission(row).images).toEqual([]);
  });

  it('reports the image count even when the keys are withheld', () => {
    expect(formatPublicSubmission(row).image_count).toBe(2);
    expect(formatPublicSubmission(row, true).image_count).toBe(2);
  });

  it('returns an empty array when the submission has no images', () => {
    expect(formatPublicSubmission({ ...row, images: [] }, true).images).toEqual([]);
    expect(formatPublicSubmission({ ...row, images: [] }).image_count).toBe(0);
  });

  it('returns an empty array when the images relation was not selected', () => {
    const { images, ...noImages } = row;
    expect(formatPublicSubmission(noImages, true).images).toEqual([]);
    expect(formatPublicSubmission(noImages).image_count).toBe(0);
  });

  it('omits submitter and verifier identity from the public payload', () => {
    const out = formatPublicSubmission(row) as Record<string, unknown>;
    expect(out).not.toHaveProperty('user_id');
    expect(out).not.toHaveProperty('user_display_name');
    expect(out).not.toHaveProperty('verified_by_display_name');
  });

  it('coerces decimal columns to numbers', () => {
    const out = formatPublicSubmission(row);
    expect(out.brix_value).toBe(19.2);
    expect(out.poor_brix).toBe(6);
    expect(out.excellent_brix).toBe(18);
  });

  it('keeps rejection state off the public payload', () => {
    const out = formatPublicSubmission(row) as Record<string, unknown>;
    expect(out).not.toHaveProperty('rejected');
    expect(out).not.toHaveProperty('rejected_at');
    expect(out).not.toHaveProperty('rejection_message');
  });
});

describe('formatFullSubmission', () => {
  it('carries the public payload through', () => {
    const out = formatFullSubmission(row);
    expect(out.images).toEqual(formatPublicSubmission(row).images);
    expect(out.id).toBe('sub-1');
  });

  it('passes the privilege flag down to the image keys', () => {
    expect(formatFullSubmission(row, true).images).toHaveLength(2);
    expect(formatFullSubmission(row).images).toEqual([]);
  });

  it('adds the submitter and verifier identity', () => {
    const out = formatFullSubmission(row);
    expect(out.user_id).toBe('u1');
    expect(out.user_display_name).toBe('Ada');
    expect(out.verified_by_display_name).toBe('Admin');
  });

  it('reports rejection state', () => {
    const out = formatFullSubmission(row, true);
    expect(out.rejected).toBe(true);
    expect(out.rejection_message).toBe('BRIX value reading too high for this crop');
    expect(out.rejected_at).toEqual(new Date('2026-05-03T00:00:00Z'));
  });

  it('reports a submission that was never rejected', () => {
    const out = formatFullSubmission({ ...row, rejectedAt: null, rejectionMessage: null }, true);
    expect(out.rejected).toBe(false);
    expect(out.rejection_message).toBeNull();
  });

  it('never leaks the rejection hash', () => {
    const out = formatFullSubmission(row, true) as Record<string, unknown>;
    expect(out).not.toHaveProperty('rejection_hash');
    expect(out).not.toHaveProperty('rejectionHash');
  });

  it('omits the photos and rejection state unless the caller is entitled to them', () => {
    const out = formatFullSubmission(row) as Record<string, unknown>;
    expect(out).not.toHaveProperty('rejected');
    expect(out).not.toHaveProperty('rejected_at');
    expect(out).not.toHaveProperty('rejection_message');
    expect(out.images).toEqual([]);
    expect(out.user_id).toBe('u1');
  });
});

describe('canSeePrivateFields', () => {
  it('lets the submitter through', () => {
    expect(canSeePrivateFields(row, { sub: 'u1', roles: [] })).toBe(true);
  });

  it('lets an admin through', () => {
    expect(canSeePrivateFields(row, { sub: 'someone-else', roles: ['admin'] })).toBe(true);
  });

  it('keeps another signed-in user out', () => {
    expect(canSeePrivateFields(row, { sub: 'u2', roles: ['contributor'] })).toBe(false);
  });

  it('keeps anonymous callers out', () => {
    expect(canSeePrivateFields(row, undefined)).toBe(false);
  });

  it('does not treat a row with no owner as everyone-owned', () => {
    expect(canSeePrivateFields({ userId: null }, { sub: 'u1', roles: [] })).toBe(false);
    expect(canSeePrivateFields({}, { sub: 'u1', roles: [] })).toBe(false);
  });
});

/** Pins the submission-image key shape: only a UUID segment names a submission. */
import { describe, it, expect } from 'vitest';
import { isSubmissionImageKey, submissionIdFromKey, generateSubmissionImageKey } from '../s3.js';

const ID = 'e68803db-2963-4230-874d-1a39b1379527';

describe('submissionIdFromKey', () => {
  it('extracts the id from a key we issued', () => {
    expect(submissionIdFromKey(generateSubmissionImageKey(ID, 'front.jpg'))).toBe(ID);
  });

  it('preserves an uppercase uuid; uuid columns compare case-insensitively', () => {
    expect(submissionIdFromKey(`submission-images/${ID.toUpperCase()}/1-a.jpg`)).toBe(ID.toUpperCase());
  });

  it.each([
    ['not a uuid', 'submission-images/not-a-uuid/1-a.jpg'],
    ['a traversal segment', 'submission-images/../victim/1-a.jpg'],
    ['a uuid missing a block', 'submission-images/e68803db-2963-4230-874d/1-a.jpg'],
    ['a uuid with a bad character', 'submission-images/g68803db-2963-4230-874d-1a39b1379527/1-a.jpg'],
    ['no filename segment', `submission-images/${ID}`],
    ['the wrong prefix', `other-images/${ID}/1-a.jpg`],
  ])('returns null for %s', (_label, key) => {
    expect(submissionIdFromKey(key)).toBeNull();
  });
});

describe('isSubmissionImageKey', () => {
  it('accepts a key in our namespace', () => {
    expect(isSubmissionImageKey(`submission-images/${ID}/1-a.jpg`)).toBe(true);
  });

  it.each([
    ['a key outside the namespace', 'other-images/x.jpg'],
    ['a non-string', 12345],
    ['null', null],
    ['undefined', undefined],
  ])('rejects %s', (_label, key) => {
    expect(isSubmissionImageKey(key)).toBe(false);
  });
});

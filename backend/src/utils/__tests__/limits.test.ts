import { describe, it, expect } from 'vitest';
import { FIELD_LIMITS, exceedsLimit } from '../limits.js';

describe('FIELD_LIMITS', () => {
  it('matches the frontend notes cap (500)', () => {
    expect(FIELD_LIMITS.NOTES).toBe(500);
  });

  it('caps PAYLOAD_JSON at 4 KB to bound on-chain payload size', () => {
    expect(FIELD_LIMITS.PAYLOAD_JSON).toBe(4096);
  });

  it('caps USER_SIGNATURE generously for a DER ECDSA signature', () => {
    // DER ECDSA is ~144 hex chars; 200 gives slack without inviting megabyte blobs.
    expect(FIELD_LIMITS.USER_SIGNATURE).toBeGreaterThanOrEqual(150);
    expect(FIELD_LIMITS.USER_SIGNATURE).toBeLessThan(1000);
  });

  it('caps USER_IDENTITY_KEY for a 33-byte compressed pubkey', () => {
    // 33 bytes hex = 66 chars; 100 gives slack.
    expect(FIELD_LIMITS.USER_IDENTITY_KEY).toBeGreaterThanOrEqual(66);
  });

  it('defines a positive cap for every documented field', () => {
    for (const [name, value] of Object.entries(FIELD_LIMITS)) {
      expect(value, `${name} should be a positive integer`).toBeGreaterThan(0);
      expect(Number.isInteger(value), `${name} should be an integer`).toBe(true);
    }
  });
});

describe('exceedsLimit', () => {
  it('returns null for a value shorter than the limit', () => {
    expect(exceedsLimit('hello', 10, 'notes')).toBeNull();
  });

  it('returns null when the value is exactly at the limit', () => {
    expect(exceedsLimit('a'.repeat(10), 10, 'notes')).toBeNull();
  });

  it('returns an error message when the value exceeds the limit', () => {
    const err = exceedsLimit('a'.repeat(11), 10, 'notes');
    expect(err).toBe('notes too long (max 10 characters)');
  });

  it('includes the field name and max in the error message', () => {
    const err = exceedsLimit('x'.repeat(501), FIELD_LIMITS.NOTES, 'outlier_notes');
    expect(err).toContain('outlier_notes');
    expect(err).toContain('500');
  });

  it('returns null for null input', () => {
    expect(exceedsLimit(null, 10, 'notes')).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(exceedsLimit(undefined, 10, 'notes')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(exceedsLimit('', 10, 'notes')).toBeNull();
  });

  it('counts characters, not bytes (multibyte characters count as one)', () => {
    // 'é' is one character but two UTF-8 bytes. The cap is by JS string length,
    // which matches what the user types and what the frontend counter shows.
    expect(exceedsLimit('é'.repeat(10), 10, 'notes')).toBeNull();
    expect(exceedsLimit('é'.repeat(11), 10, 'notes')).not.toBeNull();
  });

  it('counts emojis by JS code-unit length (note: surrogate pairs are 2 units)', () => {
    // '🍎' is one displayed character but two UTF-16 code units. JS .length sees 2.
    // Documenting this as the actual behavior — frontend counter must match.
    expect('🍎'.length).toBe(2);
    expect(exceedsLimit('🍎'.repeat(5), 10, 'notes')).toBeNull();
    expect(exceedsLimit('🍎'.repeat(6), 10, 'notes')).not.toBeNull();
  });
});

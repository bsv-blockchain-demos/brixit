import { describe, it, expect } from 'vitest';
import { validateFields } from '../certifierSign.js';

/**
 * The certifier decrypts the wallet's fields and validates the plaintext, so
 * these run against exactly what a client sends. The omitted-vs-empty email
 * distinction is the one that strands a user: the client builds cert fields in
 * src/lib/brixitCert.ts and must omit a blank email rather than send ''.
 */
describe('validateFields', () => {
  it('accepts a display name on its own', () => {
    expect(validateFields({ displayName: 'SML' })).toBeNull();
  });

  it('accepts a display name with a real email', () => {
    expect(validateFields({ displayName: 'SML', email: 'a@b.com' })).toBeNull();
  });

  it('accepts an omitted email', () => {
    // The client omits a blank email; anything else is rejected below.
    const fields: Record<string, string> = { displayName: 'SML' };
    expect('email' in fields).toBe(false);
    expect(validateFields(fields)).toBeNull();
  });

  it('rejects an empty-string email', () => {
    // The trap: '' is defined but has no '@'. A client that sends it instead of
    // omitting the field cannot mint or re-issue a certificate.
    expect(validateFields({ displayName: 'SML', email: '' })).toBe('email must be a valid address');
  });

  it('rejects an email with no @', () => {
    expect(validateFields({ displayName: 'SML', email: 'not-an-email' })).toBe('email must be a valid address');
  });

  it('accepts a legacy username-only certificate', () => {
    expect(validateFields({ username: 'legacy' })).toBeNull();
  });

  it('requires some display value', () => {
    expect(validateFields({})).toBe('displayName is required');
    expect(validateFields({ displayName: '   ' })).toBe('displayName is required');
  });

  it('rejects fields outside the allowed set', () => {
    // Adding a field to the certificate needs ALLOWED_FIELDS widened in step,
    // or issuance 400s.
    expect(validateFields({ displayName: 'SML', roles: '["admin"]' })).toBe('unexpected fields: roles');
  });

  it('names every unexpected field', () => {
    const err = validateFields({ displayName: 'SML', locationLat: '1', avatarKey: 'k' });
    expect(err).toContain('locationLat');
    expect(err).toContain('avatarKey');
  });
});

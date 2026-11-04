import { describe, it, expect } from 'vitest';
import { Utils, Hash } from '@bsv/sdk';
import { isTrustedCertificate, certTypeId } from '../trustedCertificates.js';

const b64 = (s: string) => Utils.toBase64(Utils.toArray(s, 'utf8'));
const sha256b64 = (s: string) => Utils.toBase64(Hash.sha256(Utils.toArray(s, 'utf8')));
const BACKEND = '02backendpublickey';
const cfg = {
  brixitType: 'Brixit Identity',
  myceliaCertifier: '027e1a4071b3b210166d0546299936c7abde87abc72fd61e0870babf0d0cea5756',
  myceliaType: 'Mycelia Identity',
};

describe('certTypeId', () => {
  it('is the base64 SHA-256 of the utf8 type name — 32 bytes', () => {
    expect(certTypeId('Brixit Identity')).toBe(sha256b64('Brixit Identity'));
    expect(Utils.toArray(certTypeId('Brixit Identity'), 'base64')).toHaveLength(32);
  });
});

describe('isTrustedCertificate', () => {
  it('trusts a BRIXit cert (backend certifier + hashed Brixit type)', () => {
    expect(isTrustedCertificate({ certifier: BACKEND, type: certTypeId('Brixit Identity') }, BACKEND, cfg)).toBe(true);
  });
  it('trusts a legacy BRIXit cert (raw type) so holders can still sign in', () => {
    expect(isTrustedCertificate({ certifier: BACKEND, type: b64('Brixit Identity') }, BACKEND, cfg)).toBe(true);
  });
  it('trusts a Mycelia ID cert (mycelia certifier + Mycelia type)', () => {
    expect(isTrustedCertificate({ certifier: cfg.myceliaCertifier, type: b64('Mycelia Identity') }, BACKEND, cfg)).toBe(true);
  });
  it('rejects an unknown certifier', () => {
    expect(isTrustedCertificate({ certifier: 'deadbeef', type: b64('Mycelia Identity') }, BACKEND, cfg)).toBe(false);
  });
  it('rejects a trusted certifier with the wrong type', () => {
    expect(isTrustedCertificate({ certifier: cfg.myceliaCertifier, type: b64('Brixit Identity') }, BACKEND, cfg)).toBe(false);
    expect(isTrustedCertificate({ certifier: cfg.myceliaCertifier, type: certTypeId('Brixit Identity') }, BACKEND, cfg)).toBe(false);
    expect(isTrustedCertificate({ certifier: BACKEND, type: b64('Mycelia Identity') }, BACKEND, cfg)).toBe(false);
  });
});

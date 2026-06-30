import { describe, it, expect } from 'vitest';
import { Utils } from '@bsv/sdk';
import { isTrustedCertificate } from '../trustedCertificates.js';

const b64 = (s: string) => Utils.toBase64(Utils.toArray(s, 'utf8'));
const BACKEND = '02backendpublickey';
const cfg = {
  brixitType: 'Brixit Identity',
  myceliaCertifier: '027e1a4071b3b210166d0546299936c7abde87abc72fd61e0870babf0d0cea5756',
  myceliaType: 'Mycelia Identity',
};

describe('isTrustedCertificate', () => {
  it('trusts a BRIXit cert (backend certifier + Brixit type)', () => {
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
    expect(isTrustedCertificate({ certifier: BACKEND, type: b64('Mycelia Identity') }, BACKEND, cfg)).toBe(false);
  });
});

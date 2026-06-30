import { describe, it, expect } from 'vitest';
import { Utils } from '@bsv/sdk';
import { selectCertificate, findLoginCertificate, toTypeB64, type AcceptedCert, ACCEPTED_CERTS } from '../certConfig';

const b64 = (s: string) => Utils.toBase64(Utils.toArray(s, 'utf8'));

const MYCELIA: AcceptedCert = { type: 'Mycelia Identity', typeB64: b64('Mycelia Identity'), certifier: 'mycelia-key' };
const BRIXIT: AcceptedCert = { type: 'Brixit Identity', typeB64: b64('Brixit Identity'), certifier: 'brixit-key' };
const ACCEPTED = [MYCELIA, BRIXIT];

const myceliaCert = { certifier: 'mycelia-key', type: b64('Mycelia Identity') };
const brixitCert = { certifier: 'brixit-key', type: b64('Brixit Identity') };

describe('toTypeB64', () => {
  it('base64-encodes the utf8 type string', () => {
    expect(toTypeB64('Mycelia Identity')).toBe(b64('Mycelia Identity'));
  });
});

describe('selectCertificate', () => {
  it('prefers Mycelia when the wallet holds both', () => {
    expect(selectCertificate(ACCEPTED, [brixitCert, myceliaCert])).toBe(myceliaCert);
  });
  it('falls back to BRIXit when only BRIXit is present', () => {
    expect(selectCertificate(ACCEPTED, [brixitCert])).toBe(brixitCert);
  });
  it('returns the Mycelia cert when only Mycelia is present', () => {
    expect(selectCertificate(ACCEPTED, [myceliaCert])).toBe(myceliaCert);
  });
  it('returns null when the wallet holds none', () => {
    expect(selectCertificate(ACCEPTED, [])).toBeNull();
  });
  it('ignores a cert whose certifier/type is not an accepted pair', () => {
    const stray = { certifier: 'mycelia-key', type: b64('Brixit Identity') }; // cross-mismatch
    expect(selectCertificate(ACCEPTED, [stray])).toBeNull();
  });
});

describe('findLoginCertificate', () => {
  it('returns the highest-priority cert the wallet holds', async () => {
    const top = ACCEPTED_CERTS[0];
    const cert = { certifier: top.certifier, type: top.typeB64 };
    const wallet = { listCertificates: async () => ({ certificates: [cert] }) };
    expect(await findLoginCertificate(wallet)).toBe(cert);
  });
  it('returns null when the wallet lists no certificates', async () => {
    const wallet = { listCertificates: async () => ({ certificates: [] }) };
    expect(await findLoginCertificate(wallet)).toBeNull();
  });
});

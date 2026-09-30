import { describe, it, expect } from 'vitest';
import { Utils } from '@bsv/sdk';
import { selectCertificate, findLoginCertificate, toTypeB64, buildAcceptedCerts, type AcceptedCert, ACCEPTED_CERTS } from '../certConfig';

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

describe('buildAcceptedCerts', () => {
  const both = {
    myceliaCertifier: 'mycelia-key',
    brixitCertifier: 'brixit-key',
  };

  it('accepts a cert type only when its certifier is configured', () => {
    // A hardcoded fallback here would silently accept Mycelia certs in a
    // deployment that never configured them, and they outrank BRIXit ones.
    const accepted = buildAcceptedCerts({ brixitCertifier: 'brixit-key' });
    expect(accepted.map((c) => c.type)).toEqual(['Brixit Identity']);
  });

  it('keeps Mycelia ahead of BRIXit when both are configured', () => {
    expect(buildAcceptedCerts(both).map((c) => c.certifier)).toEqual(['mycelia-key', 'brixit-key']);
  });

  it('drops BRIXit when its certifier is unset', () => {
    expect(buildAcceptedCerts({ myceliaCertifier: 'mycelia-key' }).map((c) => c.type)).toEqual([
      'Mycelia Identity',
    ]);
  });

  it('accepts nothing when neither certifier is configured', () => {
    expect(buildAcceptedCerts({})).toEqual([]);
  });

  it('treats an empty-string certifier as unconfigured', () => {
    expect(buildAcceptedCerts({ myceliaCertifier: '', brixitCertifier: 'brixit-key' })).toHaveLength(1);
  });

  it('base64-encodes each configured type', () => {
    const accepted = buildAcceptedCerts(both);
    expect(accepted[0].typeB64).toBe(b64('Mycelia Identity'));
    expect(accepted[1].typeB64).toBe(b64('Brixit Identity'));
  });

  it('allows the type names to be overridden', () => {
    const accepted = buildAcceptedCerts({ ...both, brixitType: 'Custom Identity' });
    expect(accepted[1].type).toBe('Custom Identity');
    expect(accepted[1].typeB64).toBe(b64('Custom Identity'));
  });
});

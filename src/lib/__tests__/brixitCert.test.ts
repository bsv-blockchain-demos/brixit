import { describe, it, expect, vi } from 'vitest';
import {
  BRIXIT_CERT_TYPE_B64,
  buildBrixitCertFields,
  isBrixitCert,
  reissueBrixitCert,
  applyDisplayNameChange,
} from '../brixitCert';

const CERTIFIER = '02certifierkey';
const IDENTITY_KEY = '02identitykeyaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

function fakeWallet(certificates: Array<Record<string, unknown>> = []) {
  const order: string[] = [];
  const acquired: any[] = [];
  const relinquished: any[] = [];
  return {
    order,
    acquired,
    relinquished,
    getPublicKey: async () => ({ publicKey: IDENTITY_KEY }),
    listCertificates: async () => {
      order.push('list');
      return { certificates };
    },
    acquireCertificate: async (args: any) => {
      order.push('acquire');
      acquired.push(args);
    },
    relinquishCertificate: async (args: any) => {
      order.push('relinquish');
      relinquished.push(args);
    },
  };
}

describe('buildBrixitCertFields', () => {
  it('falls back to the identity key when no name is given', () => {
    const fields = buildBrixitCertFields({ displayName: '   ' }, IDENTITY_KEY);
    expect(fields.displayName).toBe(IDENTITY_KEY);
  });

  it('keeps a trimmed display name', () => {
    expect(buildBrixitCertFields({ displayName: '  SML  ' }, IDENTITY_KEY).displayName).toBe('SML');
  });

  it('omits a blank email entirely', () => {
    // An empty-string field can't be round-tripped through the keyring —
    // MasterCertificate.decryptFields throws on it.
    expect('email' in buildBrixitCertFields({ displayName: 'SML', email: '  ' }, IDENTITY_KEY)).toBe(false);
    expect('email' in buildBrixitCertFields({ displayName: 'SML' }, IDENTITY_KEY)).toBe(false);
  });

  it('keeps a real email', () => {
    expect(buildBrixitCertFields({ displayName: 'SML', email: ' a@b.com ' }, IDENTITY_KEY).email).toBe('a@b.com');
  });
});

describe('isBrixitCert', () => {
  it('matches on both certifier and type', () => {
    expect(isBrixitCert({ certifier: CERTIFIER, type: BRIXIT_CERT_TYPE_B64 }, CERTIFIER)).toBe(true);
  });

  it('rejects a cert from another certifier', () => {
    expect(isBrixitCert({ certifier: '02other', type: BRIXIT_CERT_TYPE_B64 }, CERTIFIER)).toBe(false);
  });

  it('rejects another cert type from our certifier', () => {
    expect(isBrixitCert({ certifier: CERTIFIER, type: 'TXljZWxpYSBJZGVudGl0eQ==' }, CERTIFIER)).toBe(false);
  });

  it('rejects a missing cert', () => {
    expect(isBrixitCert(null, CERTIFIER)).toBe(false);
    expect(isBrixitCert(undefined, CERTIFIER)).toBe(false);
  });
});

describe('reissueBrixitCert', () => {
  it('acquires the new cert before relinquishing the old one', async () => {
    // Reversed, a crash between the two would leave the user with no identity.
    const wallet = fakeWallet([{ certifier: CERTIFIER, type: BRIXIT_CERT_TYPE_B64, serialNumber: 'OLD' }]);
    await reissueBrixitCert(wallet as never, CERTIFIER, { displayName: 'SML' });
    expect(wallet.order).toEqual(['list', 'acquire', 'relinquish']);
  });

  it('relinquishes the serial it saw before acquiring', async () => {
    const wallet = fakeWallet([{ certifier: CERTIFIER, type: BRIXIT_CERT_TYPE_B64, serialNumber: 'OLD' }]);
    await reissueBrixitCert(wallet as never, CERTIFIER, { displayName: 'SML' });
    expect(wallet.relinquished[0]).toMatchObject({ serialNumber: 'OLD', certifier: CERTIFIER });
  });

  it('acquires without relinquishing when the wallet holds no brixit cert', async () => {
    const wallet = fakeWallet([]);
    await reissueBrixitCert(wallet as never, CERTIFIER, { displayName: 'SML' });
    expect(wallet.order).toEqual(['list', 'acquire']);
    expect(wallet.relinquished).toHaveLength(0);
  });

  it('never relinquishes a cert belonging to another certifier', async () => {
    const wallet = fakeWallet([{ certifier: '02other', type: BRIXIT_CERT_TYPE_B64, serialNumber: 'FOREIGN' }]);
    await reissueBrixitCert(wallet as never, CERTIFIER, { displayName: 'SML' });
    expect(wallet.relinquished).toHaveLength(0);
  });

  it('issues the new cert with our type and certifier', async () => {
    const wallet = fakeWallet([]);
    await reissueBrixitCert(wallet as never, CERTIFIER, { displayName: 'SML' });
    expect(wallet.acquired[0]).toMatchObject({
      type: BRIXIT_CERT_TYPE_B64,
      certifier: CERTIFIER,
      acquisitionProtocol: 'issuance',
    });
  });
});

describe('applyDisplayNameChange', () => {
  function deps(over: Partial<Parameters<typeof applyDisplayNameChange>[0]> = {}) {
    const order: string[] = [];
    const wallet = fakeWallet([{ certifier: CERTIFIER, type: BRIXIT_CERT_TYPE_B64, serialNumber: 'OLD' }]);
    const persistToDb = vi.fn(async () => { order.push('db'); });
    const reLogin = vi.fn(async () => { order.push('relogin'); });
    const loadCurrentCert = vi.fn(async () => {
      order.push('loadcert');
      return {
        cert: { certifier: CERTIFIER, type: BRIXIT_CERT_TYPE_B64, serialNumber: 'OLD' },
        email: undefined as string | undefined,
      };
    });
    const base = {
      currentDisplayName: 'Old Name',
      newDisplayName: 'SML',
      wallet: wallet as never,
      certifier: CERTIFIER,
      loadCurrentCert,
      persistToDb,
      reLogin,
    };
    return { order, wallet, persistToDb, reLogin, loadCurrentCert, args: { ...base, ...over } };
  }

  it('does nothing when the name is unchanged', async () => {
    const d = deps({ newDisplayName: '  Old Name  ' });
    const result = await applyDisplayNameChange(d.args);
    expect(result).toEqual({ changed: false, certReissued: false });
    expect(d.persistToDb).not.toHaveBeenCalled();
  });

  it('refuses without a wallet, before writing anything', async () => {
    const d = deps({ wallet: null });
    await expect(applyDisplayNameChange(d.args)).rejects.toThrow('WALLET_REQUIRED');
    expect(d.persistToDb).not.toHaveBeenCalled();
  });

  it('writes the database before touching the wallet', async () => {
    // DB first so a rejected name fails before the user gets a wallet prompt.
    const d = deps();
    await applyDisplayNameChange(d.args);
    expect(d.order[0]).toBe('db');
  });

  it('re-logs in after re-issuing so the stored serial repoints', async () => {
    const d = deps();
    const result = await applyDisplayNameChange(d.args);
    expect(d.wallet.order).toContain('acquire');
    expect(d.order).toEqual(['db', 'loadcert', 'relogin']);
    expect(result).toEqual({ changed: true, certReissued: true });
  });

  it('reads the certificate only after the database write', async () => {
    // Reading it decrypts fields, which can prompt the wallet — a name the
    // server rejects should fail before the user is asked to approve anything.
    const d = deps();
    await applyDisplayNameChange(d.args);
    expect(d.order.indexOf('db')).toBeLessThan(d.order.indexOf('loadcert'));
  });

  it('carries the existing cert email onto the new cert', async () => {
    // A rename must not silently wipe the email the cert already carried.
    const d = deps();
    d.loadCurrentCert.mockResolvedValue({
      cert: { certifier: CERTIFIER, type: BRIXIT_CERT_TYPE_B64, serialNumber: 'OLD' },
      email: 'a@b.com',
    });
    await applyDisplayNameChange({ ...d.args, loadCurrentCert: d.loadCurrentCert });
    expect(d.wallet.acquired[0].fields).toMatchObject({ displayName: 'SML', email: 'a@b.com' });
  });

  it('updates the database but skips the cert for a non-brixit cert', async () => {
    // Mycelia certs are issued by a different certifier; we cannot re-issue them.
    const d = deps();
    d.loadCurrentCert.mockResolvedValue({
      cert: { certifier: '02mycelia', type: 'TXljZWxpYSBJZGVudGl0eQ==', serialNumber: 'M1' },
      email: undefined,
    });
    const result = await applyDisplayNameChange({ ...d.args, loadCurrentCert: d.loadCurrentCert });
    expect(d.persistToDb).toHaveBeenCalledWith('SML');
    expect(d.wallet.acquired).toHaveLength(0);
    expect(d.reLogin).not.toHaveBeenCalled();
    expect(result).toEqual({ changed: true, certReissued: false });
  });
});

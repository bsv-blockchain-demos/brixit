/**
 * Issuing and re-issuing the BRIXit identity certificate.
 *
 * The certificate is the source of truth for a display name: `walletAuthVerify`
 * copies it onto `users.display_name` at every login. A name saved to the
 * database alone is therefore reverted on the user's next sign-in, so a rename
 * has to re-issue the certificate as well.
 *
 * Only BRIXit-issued certificates can be re-issued here. A Mycelia certificate
 * is signed by a different certifier, so its holder keeps the database change
 * and no certificate is touched.
 */
import { Utils } from '@bsv/sdk';
import { API_BASE } from './api';

export const BRIXIT_CERT_TYPE: string = (import.meta.env.VITE_CERT_TYPE as string) || 'Brixit Identity';
export const BRIXIT_CERT_TYPE_B64: string = Utils.toBase64(Utils.toArray(BRIXIT_CERT_TYPE, 'utf8'));
export const BRIXIT_CERTIFIER_KEY: string = import.meta.env.VITE_SERVER_PUBLIC_KEY as string;

export interface CertFields {
  displayName: string;
  email?: string;
}

interface CertWallet {
  getPublicKey: (args: { identityKey: true }) => Promise<{ publicKey: string }>;
  listCertificates: (args: any) => Promise<{ certificates?: any[] }>;
  acquireCertificate: (args: any) => Promise<unknown>;
  relinquishCertificate: (args: any) => Promise<unknown>;
}


/**
 * Build the certificate's field map.
 *
 * A blank email is omitted rather than sent as '': an empty-string field cannot
 * be round-tripped through the keyring, and `MasterCertificate.decryptFields`
 * throws on it when the certificate is later read back.
 */
export function buildBrixitCertFields(fields: CertFields, identityKey: string): Record<string, string> {
  const certFields: Record<string, string> = {
    displayName: fields.displayName.trim() || identityKey,
  };
  const email = fields.email?.trim();
  if (email) certFields.email = email;
  return certFields;
}

/** True when a certificate is one of ours — both certifier and type must match. */
export function isBrixitCert(
  cert: { certifier?: string; type?: string } | null | undefined,
  certifier: string,
): boolean {
  if (!cert) return false;
  return cert.certifier === certifier && cert.type === BRIXIT_CERT_TYPE_B64;
}

/** Issue a BRIXit identity certificate for the wallet's identity key. */
export async function acquireBrixitCert(
  wallet: CertWallet,
  certifier: string,
  fields: CertFields,
): Promise<void> {
  const { publicKey: identityKey } = await wallet.getPublicKey({ identityKey: true });
  await wallet.acquireCertificate({
    type: BRIXIT_CERT_TYPE_B64,
    fields: buildBrixitCertFields(fields, identityKey),
    acquisitionProtocol: 'issuance',
    certifier,
    certifierUrl: `${API_BASE}/api/certifier`,
  });
}

/**
 * Replace the wallet's BRIXit certificate with one carrying `fields`.
 *
 * The old serial is read first, the new certificate acquired, and only then is
 * the old one relinquished — so a failure part-way leaves two valid
 * certificates rather than none.
 */
export async function reissueBrixitCert(
  wallet: CertWallet,
  certifier: string,
  fields: CertFields,
): Promise<void> {
  const { certificates } = await wallet.listCertificates({
    certifiers: [certifier],
    types: [BRIXIT_CERT_TYPE_B64],
    limit: 1,
  });
  const old = (certificates ?? []).find((c) => isBrixitCert(c, certifier));

  await acquireBrixitCert(wallet, certifier, fields);

  if (old?.serialNumber) {
    await wallet.relinquishCertificate({
      type: BRIXIT_CERT_TYPE_B64,
      serialNumber: old.serialNumber,
      certifier,
    });
  }
}

export interface DisplayNameChange {
  currentDisplayName: string | null;
  newDisplayName: string;
  wallet: CertWallet | null;
  certifier: string;
  /** The certificate the session is currently authenticated with, plus its email. */
  loadCurrentCert: () => Promise<{ cert: unknown; email?: string } | null>;
  persistToDb: (displayName: string) => Promise<void>;
  reLogin: () => Promise<void>;
}

/**
 * Apply a display-name change to both the database and the certificate.
 *
 * The database is written first so a name the server rejects fails before the
 * user is asked to approve anything in their wallet. The re-login afterwards
 * repoints `wallet_identities.certificate_serial`, which the re-issue
 * invalidated.
 *
 * Throws `WALLET_REQUIRED` before writing anything when no wallet is connected,
 * rather than saving a name the next login would revert.
 */
export async function applyDisplayNameChange(
  opts: DisplayNameChange,
): Promise<{ changed: boolean; certReissued: boolean }> {
  const next = opts.newDisplayName.trim();
  if (next === (opts.currentDisplayName ?? '').trim()) {
    return { changed: false, certReissued: false };
  }

  if (!opts.wallet) throw new Error('WALLET_REQUIRED');

  await opts.persistToDb(next);

  // Read after the write: decrypting the certificate's fields can prompt the
  // wallet, and a name the server rejects should fail before that happens.
  const current = await opts.loadCurrentCert();

  // Another certifier signed it — only they can re-issue it. Login reads this
  // certificate, so its name is what the next sign-in restores.
  if (!isBrixitCert(current?.cert as any, opts.certifier)) {
    return { changed: true, certReissued: false };
  }

  await reissueBrixitCert(opts.wallet, opts.certifier, {
    displayName: next,
    email: current?.email,
  });
  await opts.reLogin();

  return { changed: true, certReissued: true };
}

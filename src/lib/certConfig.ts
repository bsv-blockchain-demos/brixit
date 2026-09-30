import { Utils } from '@bsv/sdk';

/** base64-encode a cert type string the way the wallet stores/queries it. */
export const toTypeB64 = (type: string): string =>
  Utils.toBase64(Utils.toArray(type, 'utf8'));

export interface AcceptedCert {
  /** Human-readable cert type, e.g. 'Mycelia Identity'. */
  type: string;
  /** base64-encoded type, as stored/queried by the wallet. */
  typeB64: string;
  /** Certifier identity public key (hex). */
  certifier: string;
}

export interface CertEnv {
  myceliaType?: string;
  myceliaCertifier?: string;
  brixitType?: string;
  brixitCertifier?: string;
}

/**
 * Build the accepted (certifier, type) pairs, highest priority first: Mycelia ID
 * ahead of BRIXit, per the V2 migration direction.
 *
 * A cert type is accepted only when a certifier is supplied for it; the caller
 * owns any fallback. Order matters — the first accepted pair the wallet holds
 * wins the login, and only that certifier can re-issue its own certificates.
 */
export function buildAcceptedCerts(env: CertEnv): AcceptedCert[] {
  return [
    { type: env.myceliaType || 'Mycelia Identity', certifier: env.myceliaCertifier },
    { type: env.brixitType || 'Brixit Identity', certifier: env.brixitCertifier },
  ]
    .filter((c): c is { type: string; certifier: string } => Boolean(c.certifier))
    .map((c) => ({ type: c.type, certifier: c.certifier, typeB64: toTypeB64(c.type) }));
}

// Mycelia certificates were issued ahead of that app's release, so deployments
// that never set VITE_MYCELIA_CERTIFIER still accept them and their holders can
// sign in. Setting the variable overrides this; setting it empty opts out, which
// is what a BRIXit-certificate holder needs in order to re-issue their own
// certificate — Mycelia outranks BRIXit here, and only its certifier can
// re-issue a Mycelia certificate.
const MYCELIA_CERTIFIER_FALLBACK = '037e6afda08c6e1a095e727dbbbb28dec2499fdc12e95d4dd693004048a460f4c3';

export const ACCEPTED_CERTS: AcceptedCert[] = buildAcceptedCerts({
  myceliaType: import.meta.env.VITE_MYCELIA_CERT_TYPE as string,
  myceliaCertifier:
    (import.meta.env.VITE_MYCELIA_CERTIFIER as string) ?? MYCELIA_CERTIFIER_FALLBACK,
  brixitType: import.meta.env.VITE_CERT_TYPE as string,
  brixitCertifier: import.meta.env.VITE_SERVER_PUBLIC_KEY as string,
});

export const ACCEPTED_CERTIFIERS: string[] = ACCEPTED_CERTS.map((c) => c.certifier);
export const ACCEPTED_TYPE_B64S: string[] = ACCEPTED_CERTS.map((c) => c.typeB64);

/**
 * Pick the highest-priority cert (per `accepted` order) that the wallet holds.
 * A match requires BOTH certifier and type to equal an accepted pair, so a
 * cross-mismatch is never selected. Returns null if none match.
 */
export function selectCertificate(
  accepted: AcceptedCert[],
  certificates: Array<{ certifier: string; type: string }>,
): any | null {
  for (const a of accepted) {
    const match = certificates.find((c) => c.certifier === a.certifier && c.type === a.typeB64);
    if (match) return match;
  }
  return null;
}

/**
 * List the certs the wallet holds for any accepted (certifier, type) pair and
 * return the highest-priority one (Mycelia ID before BRIXit), or null.
 */
export async function findLoginCertificate(
  wallet: { listCertificates: (args: any) => Promise<{ certificates?: any[] }> },
): Promise<any | null> {
  if (ACCEPTED_CERTS.length === 0) return null;
  const { certificates } = await wallet.listCertificates({
    certifiers: ACCEPTED_CERTIFIERS,
    types: ACCEPTED_TYPE_B64S,
  });
  return selectCertificate(ACCEPTED_CERTS, certificates ?? []);
}

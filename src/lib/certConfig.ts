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

// Priority order: Mycelia ID first (V2 migration direction), BRIXit fallback.
// Entries whose certifier is missing (env unset) are dropped.
export const ACCEPTED_CERTS: AcceptedCert[] = [
  {
    type: (import.meta.env.VITE_MYCELIA_CERT_TYPE as string) || 'Mycelia Identity',
    certifier:
      (import.meta.env.VITE_MYCELIA_CERTIFIER as string) ||
      '037e6afda08c6e1a095e727dbbbb28dec2499fdc12e95d4dd693004048a460f4c3',
  },
  {
    type: (import.meta.env.VITE_CERT_TYPE as string) || 'Brixit Identity',
    certifier: import.meta.env.VITE_SERVER_PUBLIC_KEY as string,
  },
]
  .filter((c): c is { type: string; certifier: string } => Boolean(c.certifier))
  .map((c) => ({ type: c.type, certifier: c.certifier, typeB64: toTypeB64(c.type) }));

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

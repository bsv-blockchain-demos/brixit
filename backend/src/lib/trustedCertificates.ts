import { Utils, Hash } from '@bsv/sdk';

const toTypeB64 = (type: string): string =>
  Utils.toBase64(Utils.toArray(type, 'utf8'));

/** A certificate type id: base64 SHA-256 of the type name, the 32 bytes the SDK signs. */
export const certTypeId = (type: string): string =>
  Utils.toBase64(Hash.sha256(Utils.toArray(type, 'utf8')));

export interface TrustedCertConfig {
  /** This backend's own cert type (issued by the server wallet). */
  brixitType: string;
  /** Mycelia ID certifier public key (hex). */
  myceliaCertifier: string;
  /** Mycelia ID cert type. */
  myceliaType: string;
}

/**
 * A certificate is trusted iff its certifier is one we recognise AND its type
 * matches one of that certifier's expected types. The signature itself is
 * validated separately via cert.verify() in the route.
 *
 * BRIXit certs issued before the 32-byte type carry the raw type name; they are
 * accepted so their holders can sign in, and the client re-issues them at login.
 */
export function isTrustedCertificate(
  cert: { certifier: string; type: string },
  backendPublicKey: string,
  cfg: TrustedCertConfig,
): boolean {
  const trusted = new Map<string, string[]>([
    [backendPublicKey, [certTypeId(cfg.brixitType), toTypeB64(cfg.brixitType)]],
    [cfg.myceliaCertifier, [toTypeB64(cfg.myceliaType)]],
  ]);
  return trusted.get(cert.certifier)?.includes(cert.type) ?? false;
}

import { Utils } from '@bsv/sdk';

const toTypeB64 = (type: string): string =>
  Utils.toBase64(Utils.toArray(type, 'utf8'));

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
 * matches that certifier's expected type. The signature itself is validated
 * separately via cert.verify() in the route.
 */
export function isTrustedCertificate(
  cert: { certifier: string; type: string },
  backendPublicKey: string,
  cfg: TrustedCertConfig,
): boolean {
  const trusted = new Map<string, string>([
    [backendPublicKey, toTypeB64(cfg.brixitType)],
    [cfg.myceliaCertifier, toTypeB64(cfg.myceliaType)],
  ]);
  const expectedType = trusted.get(cert.certifier);
  return expectedType !== undefined && cert.type === expectedType;
}

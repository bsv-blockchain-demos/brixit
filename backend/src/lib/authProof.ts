import type { WalletProtocol } from '@bsv/sdk';
import type { AuthProofOptions } from '@bsv/auth';

/** `protocol` drives key derivation — MUST match the frontend (letters/numbers/spaces only). */
export const AUTH_OPTIONS: AuthProofOptions = { protocol: [2, 'brixit auth'] as WalletProtocol };

export type { AuthProof, AuthSigData } from '@bsv/auth';

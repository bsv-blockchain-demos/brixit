import type { WalletProtocol } from '@bsv/sdk';
import { createAuthProof as libCreateAuthProof } from '@bsv/auth';
import type { AuthProof, AuthProofOptions, ProofSignerWallet } from '@bsv/auth';

/** `protocol` drives key derivation — MUST match the backend (letters/numbers/spaces only). */
export const AUTH_OPTIONS: AuthProofOptions = { protocol: [2, 'brixit auth'] as WalletProtocol };

/** Signed proof authorizing `action` for this wallet, addressed to the backend. */
export function createAuthProof(
    wallet: ProofSignerWallet,
    backendPublicKey: string,
    action: string,
): Promise<AuthProof> {
    return libCreateAuthProof(wallet, backendPublicKey, action, AUTH_OPTIONS);
}

export type { AuthProof } from '@bsv/auth';

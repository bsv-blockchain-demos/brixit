import { verifyAuthProof as libVerifyAuthProof } from '@bsv/auth';
import type {
    AuthProof,
    ConsumeNonce,
    ProofVerifierWallet,
    VerifyAuthProofResult,
} from '@bsv/auth';
import { AUTH_OPTIONS } from './authProof.js';
import { consumeNonce } from './nonceStore.js';

export type { VerifyAuthProofResult } from '@bsv/auth';

/**
 * Verifies a proof with brixit's shared options + the in-memory nonce store.
 * Returns the authenticated identityKey on success. `deps` is injectable for tests.
 */
export async function verifyAuthProof(
    serverWallet: ProofVerifierWallet,
    proof: AuthProof | undefined | null,
    expectedAction: string,
    deps: { now?: number; consumeNonce?: ConsumeNonce } = {},
): Promise<VerifyAuthProofResult> {
    return libVerifyAuthProof(
        serverWallet,
        proof,
        expectedAction,
        { consumeNonce: deps.consumeNonce ?? consumeNonce, now: deps.now },
        AUTH_OPTIONS,
    );
}

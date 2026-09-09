import type { Response, NextFunction } from 'express';
import { verifyAuthProof } from '../lib/verifyAuthProof.js';
import type { VerifyAuthProofResult } from '../lib/verifyAuthProof.js';
import type { AuthenticatedRequest } from './auth.js';

/** Lets the client tell a spent proof from an expired JWT, since both are 401. */
export const PROOF_ERROR_CODE = 'auth_proof_invalid';

export interface ProofAuthenticatedRequest extends AuthenticatedRequest {
    /** Identity key recovered from the proof signature, not from the JWT. */
    proofIdentityKey?: string;
}

type Verify = (proof: unknown, action: string) => Promise<VerifyAuthProofResult>;

/**
 * Imported lazily: serverWallet throws without SERVER_PRIVATE_KEY and blocks on
 * a networked top-level await, which unit tests must not trigger.
 */
const defaultVerify: Verify = async (proof, action) => {
    const { default: serverWallet } = await import('../serverWallet.js');
    return verifyAuthProof(serverWallet as any, proof as any, action);
};

/**
 * Requires a single-use, expiry-bound signature over `action`, carried as
 * `proof` on the JSON body. Runs after requireAuth: the JWT says which session
 * is calling, the proof shows the caller still holds the key.
 */
export function requireAuthProof(action: string, deps: { verify?: Verify } = {}) {
    const verify = deps.verify ?? defaultVerify;

    return async (req: ProofAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
        let result: VerifyAuthProofResult;
        try {
            result = await verify((req.body as { proof?: unknown } | undefined)?.proof, action);
        } catch (err: any) {
            console.error('[AUTH-PROOF] Verification threw:', err?.message);
            res.status(401).json({ error: 'Could not verify authorization proof', code: PROOF_ERROR_CODE });
            return;
        }

        if (!result.valid) {
            res.status(401).json({ error: result.error ?? 'Invalid authorization proof', code: PROOF_ERROR_CODE });
            return;
        }

        req.proofIdentityKey = result.identityKey;
        next();
    };
}

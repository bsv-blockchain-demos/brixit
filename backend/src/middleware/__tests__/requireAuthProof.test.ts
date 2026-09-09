import { describe, it, expect, vi } from 'vitest';
import { requireAuthProof, PROOF_ERROR_CODE } from '../requireAuthProof.js';

const ACTION = 'admin-reject';
const IDENTITY = '02abc';

const proof = {
    data: { action: ACTION, identityKey: IDENTITY, expiresAt: 1, nonce: 'bm9uY2U=' },
    signature: [1, 2, 3],
};

function mockRes() {
    const res: any = {};
    res.status = vi.fn(() => res);
    res.json = vi.fn(() => res);
    return res;
}

describe('requireAuthProof', () => {
    it('passes the request on and attaches the verified identity key', async () => {
        const verify = vi.fn(async () => ({ valid: true, identityKey: IDENTITY }));
        const req: any = { body: { proof } };
        const res = mockRes();
        const next = vi.fn();

        await requireAuthProof(ACTION, { verify })(req, res, next);

        expect(next).toHaveBeenCalledOnce();
        expect(req.proofIdentityKey).toBe(IDENTITY);
        expect(res.status).not.toHaveBeenCalled();
    });

    it('hands the verifier the proof from the body and the expected action', async () => {
        const verify = vi.fn(async () => ({ valid: true, identityKey: IDENTITY }));
        await requireAuthProof(ACTION, { verify })({ body: { proof } } as any, mockRes(), vi.fn());

        expect(verify).toHaveBeenCalledWith(proof, ACTION);
    });

    it('rejects with 401 and the proof marker when the proof is invalid', async () => {
        const verify = vi.fn(async () => ({ valid: false, error: 'Invalid signature' }));
        const res = mockRes();
        const next = vi.fn();

        await requireAuthProof(ACTION, { verify })({ body: { proof } } as any, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'Invalid signature', code: PROOF_ERROR_CODE });
    });

    it('rejects when the body carries no proof', async () => {
        const verify = vi.fn(async () => ({ valid: false, error: 'Malformed proof' }));
        const res = mockRes();
        const next = vi.fn();

        await requireAuthProof(ACTION, { verify })({ body: {} } as any, res, next);

        expect(verify).toHaveBeenCalledWith(undefined, ACTION);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    it('rejects when there is no body at all', async () => {
        const verify = vi.fn(async () => ({ valid: false, error: 'Malformed proof' }));
        const res = mockRes();
        const next = vi.fn();

        await requireAuthProof(ACTION, { verify })({} as any, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    it('falls back to a generic message when the verifier gives no reason', async () => {
        const verify = vi.fn(async () => ({ valid: false }));
        const res = mockRes();

        await requireAuthProof(ACTION, { verify })({ body: { proof } } as any, res, vi.fn());

        expect(res.json).toHaveBeenCalledWith({
            error: 'Invalid authorization proof',
            code: PROOF_ERROR_CODE,
        });
    });

    it('returns 401 rather than throwing when the verifier itself fails', async () => {
        const verify = vi.fn(async () => { throw new Error('wallet unreachable'); });
        const res = mockRes();
        const next = vi.fn();

        await requireAuthProof(ACTION, { verify })({ body: { proof } } as any, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });
});

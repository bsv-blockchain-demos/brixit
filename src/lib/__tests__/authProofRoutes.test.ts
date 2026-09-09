import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { authActionForRequest, withProof, PROTECTED_ACTIONS, PROOF_ERROR_CODE } from '../authProofRoutes';

const proof = {
    data: { action: 'submission-edit', identityKey: '02abc', expiresAt: 1, nonce: 'bm9uY2U=' },
    signature: [1, 2, 3],
} as any;

describe('authActionForRequest', () => {
    it.each([
        ['/api/admin/roles/grant', 'POST', 'admin-roles-grant'],
        ['/api/admin/roles/revoke', 'POST', 'admin-roles-revoke'],
        ['/api/admin/submissions/abc-123/verify', 'POST', 'admin-verify'],
        ['/api/admin/submissions/abc-123/reject', 'POST', 'admin-reject'],
        ['/api/admin/submissions/abc-123', 'DELETE', 'admin-delete'],
        ['/api/submissions/create', 'POST', 'submission-create'],
        ['/api/submissions/abc-123/retry-anchor', 'POST', 'submission-retry-anchor'],
        ['/api/submissions/abc-123/resubmit', 'POST', 'submission-resubmit'],
        ['/api/submissions/abc-123', 'PUT', 'submission-edit'],
        ['/api/submissions/abc-123', 'DELETE', 'submission-delete'],
    ])('resolves %s %s', (path, method, action) => {
        expect(authActionForRequest(path, method)).toBe(action);
    });

    it('distinguishes edit from delete on the same path by method alone', () => {
        expect(authActionForRequest('/api/submissions/x', 'PUT')).toBe('submission-edit');
        expect(authActionForRequest('/api/submissions/x', 'DELETE')).toBe('submission-delete');
    });

    it('resolves a lowercase method the same as an uppercase one', () => {
        expect(authActionForRequest('/api/submissions/x', 'put')).toBe('submission-edit');
    });

    it('ignores a query string', () => {
        expect(authActionForRequest('/api/submissions/x?scope=mine', 'DELETE')).toBe('submission-delete');
    });

    it.each([
        ['/api/admin/crud/crops/abc', 'DELETE'],
        ['/api/admin/crud/venues/abc/verify', 'POST'],
        ['/api/admin/crud/brands/abc', 'PUT'],
        ['/api/users/me', 'PUT'],
        ['/api/submissions/abc-123', 'GET'],
        ['/api/submissions', 'GET'],
        ['/api/auth/refresh', 'POST'],
        ['/api/upload/presigned-url', 'POST'],
    ])('leaves %s %s unprotected', (path, method) => {
        expect(authActionForRequest(path, method)).toBeNull();
    });

    it('does not treat a nested admin crud path as a protected admin route', () => {
        expect(authActionForRequest('/api/admin/crud/submissions/abc', 'DELETE')).toBeNull();
    });
});

describe('withProof', () => {
    it('adds the proof to an existing JSON body', () => {
        expect(JSON.parse(withProof(JSON.stringify({ reject: true, message: 'no' }), proof)))
            .toEqual({ reject: true, message: 'no', proof });
    });

    it('creates a body when the request has none', () => {
        expect(JSON.parse(withProof(undefined, proof))).toEqual({ proof });
    });

    it('creates a body for an empty-string body', () => {
        expect(JSON.parse(withProof('', proof))).toEqual({ proof });
    });

    it('refuses FormData, which cannot carry a proof', () => {
        expect(() => withProof(new FormData(), proof)).toThrow(/FormData/);
    });

    it('refuses a non-object JSON body', () => {
        expect(() => withProof('[1,2,3]', proof)).toThrow(/object/);
    });
});

describe('parity with the backend action constants', () => {
    it('uses exactly the ten actions the backend declares', () => {
        const source = readFileSync('backend/src/lib/authActions.ts', 'utf8');
        const block = source.slice(source.indexOf('AUTH_ACTIONS'), source.indexOf('} as const'));
        const backendActions = [...block.matchAll(/:\s*'([^']+)'/g)].map((m) => m[1]);

        expect(backendActions).toHaveLength(10);
        expect([...PROTECTED_ACTIONS].sort()).toEqual([...backendActions].sort());
    });

    it('uses the same proof error code as the backend middleware', () => {
        const source = readFileSync('backend/src/middleware/requireAuthProof.ts', 'utf8');
        const backendCode = source.match(/PROOF_ERROR_CODE\s*=\s*'([^']+)'/)?.[1];

        expect(backendCode).toBe(PROOF_ERROR_CODE);
    });
});

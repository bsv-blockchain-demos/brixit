import type { AuthProof } from '@bsv/auth';

interface ProtectedRoute {
    method: 'POST' | 'PUT' | 'DELETE';
    pattern: RegExp;
    action: string;
}

/**
 * Writes that require a signed proof. Patterns are anchored so sibling trees
 * such as /api/admin/crud/... never match. Values must equal the constants in
 * backend/src/lib/authActions.ts.
 */
const PROTECTED_ROUTES: ProtectedRoute[] = [
    { method: 'POST', pattern: /^\/api\/admin\/roles\/grant$/, action: 'admin-roles-grant' },
    { method: 'POST', pattern: /^\/api\/admin\/roles\/revoke$/, action: 'admin-roles-revoke' },
    { method: 'POST', pattern: /^\/api\/admin\/submissions\/[^/]+\/verify$/, action: 'admin-verify' },
    { method: 'POST', pattern: /^\/api\/admin\/submissions\/[^/]+\/reject$/, action: 'admin-reject' },
    { method: 'DELETE', pattern: /^\/api\/admin\/submissions\/[^/]+$/, action: 'admin-delete' },
    { method: 'POST', pattern: /^\/api\/submissions\/create$/, action: 'submission-create' },
    { method: 'POST', pattern: /^\/api\/submissions\/[^/]+\/retry-anchor$/, action: 'submission-retry-anchor' },
    { method: 'POST', pattern: /^\/api\/submissions\/[^/]+\/resubmit$/, action: 'submission-resubmit' },
    { method: 'PUT', pattern: /^\/api\/submissions\/[^/]+$/, action: 'submission-edit' },
    { method: 'DELETE', pattern: /^\/api\/submissions\/[^/]+$/, action: 'submission-delete' },
];

/** Mirrors PROOF_ERROR_CODE in backend/src/middleware/requireAuthProof.ts. */
export const PROOF_ERROR_CODE = 'auth_proof_invalid';

/** Every action this table can produce; the parity test compares it to the backend. */
export const PROTECTED_ACTIONS: readonly string[] = PROTECTED_ROUTES.map((r) => r.action);

/**
 * The action to sign for this request, or null if the route needs no proof.
 * `method` is the effective method, which for a tunnelled PUT or DELETE is the
 * X-Brixit-Method value rather than the POST actually put on the wire.
 */
export function authActionForRequest(path: string, method: string): string | null {
    const pathname = path.split('?')[0];
    const verb = method.toUpperCase();
    return PROTECTED_ROUTES.find((r) => r.method === verb && r.pattern.test(pathname))?.action ?? null;
}

/** Merges the proof into a JSON request body, creating one if the request had none. */
export function withProof(body: BodyInit | null | undefined, proof: AuthProof): string {
    if (body instanceof FormData) {
        throw new Error('Cannot attach an authorization proof to a FormData body');
    }

    let base: unknown = {};
    if (typeof body === 'string' && body.length > 0) {
        base = JSON.parse(body);
    }
    if (base === null || typeof base !== 'object' || Array.isArray(base)) {
        throw new Error('Cannot attach an authorization proof to a non-object body');
    }

    return JSON.stringify({ ...(base as Record<string, unknown>), proof });
}

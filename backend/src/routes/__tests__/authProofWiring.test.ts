import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Pins which AUTH_ACTIONS key is wired to which route. authActions.test-style
 * parity checks (frontend authProofRoutes.test.ts) only confirm the ten action
 * *values* exist; they don't catch a crossed pairing, e.g.
 * requireAuthProof(AUTH_ACTIONS.adminRolesRevoke) attached to /roles/grant,
 * which would pass those checks and only fail at runtime.
 */

const adminSource = readFileSync('src/routes/admin.ts', 'utf8');
const submissionsSource = readFileSync('src/routes/submissions.ts', 'utf8');
const indexSource = readFileSync('src/index.ts', 'utf8');

/**
 * Returns the single source line that declares the route at `routeText` with a
 * requireAuthProof guard, failing loudly if none (or more than one) does. Some
 * routes are mentioned on more than one line (e.g. a rate-limiter mount ahead
 * of the real route registration), so both the route text and the guard must
 * be present together to identify the right line.
 */
function guardedRouteLine(source: string, routeText: string): string {
    const lines = source.split('\n').filter((l) => l.includes(routeText) && l.includes('requireAuthProof('));
    expect(lines, `expected exactly one requireAuthProof-guarded line containing ${JSON.stringify(routeText)}`).toHaveLength(1);
    return lines[0];
}

function countOccurrences(source: string, pattern: RegExp): number {
    return [...source.matchAll(pattern)].length;
}

/** Returns the single source line containing `needle`, failing loudly if none (or more than one) does. */
function soleLineContaining(source: string, needle: string): string {
    const lines = source.split('\n').filter((l) => l.includes(needle));
    expect(lines, `expected exactly one line containing ${JSON.stringify(needle)}`).toHaveLength(1);
    return lines[0];
}

describe('requireAuthProof route wiring', () => {
    it.each([
        [adminSource, "'/roles/grant'", 'AUTH_ACTIONS.adminRolesGrant'],
        [adminSource, "'/roles/revoke'", 'AUTH_ACTIONS.adminRolesRevoke'],
        [adminSource, "'/submissions/:id/verify'", 'AUTH_ACTIONS.adminVerify'],
        [adminSource, "'/submissions/:id/reject'", 'AUTH_ACTIONS.adminReject'],
        [adminSource, "router.delete('/submissions/:id'", 'AUTH_ACTIONS.adminDelete'],
        [submissionsSource, "'/:id/retry-anchor'", 'AUTH_ACTIONS.submissionRetryAnchor'],
        [submissionsSource, "'/:id/resubmit'", 'AUTH_ACTIONS.submissionResubmit'],
        [submissionsSource, "router.put('/:id'", 'AUTH_ACTIONS.submissionEdit'],
        [submissionsSource, "router.delete('/:id'", 'AUTH_ACTIONS.submissionDelete'],
        [indexSource, "'/api/submissions/create'", 'AUTH_ACTIONS.submissionCreate'],
    ])('pairs %s with %s', (source, routeText, actionExpr) => {
        const line = guardedRouteLine(source, routeText);
        expect(line).toContain(actionExpr);
    });

    it('has exactly ten requireAuthProof call sites across the three route files', () => {
        const pattern = /requireAuthProof\(/g;
        const total =
            countOccurrences(adminSource, pattern) +
            countOccurrences(submissionsSource, pattern) +
            countOccurrences(indexSource, pattern);

        expect(total).toBe(10);
    });

    it('does not attach requireAuthProof to the /api/admin/crud mount', () => {
        const line = soleLineContaining(indexSource, "/api/admin/crud'");
        expect(line).not.toContain('requireAuthProof');
    });
});

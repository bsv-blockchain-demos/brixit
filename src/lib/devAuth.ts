/**
 * DEV-only auth bypass — lets the authenticated UI render without a running
 * backend or a BSV wallet.
 *
 * Enable by setting VITE_DEV_AUTH=1 in your local .env. Optionally set
 * VITE_DEV_AUTH_ROLE=admin|contributor|user to exercise role-gated UI
 * (admin unlocks /admin; isAdmin is derived from role === "admin").
 *
 * Safety: `import.meta.env.DEV` is statically replaced with `false` in
 * production builds, so DEV_AUTH_ENABLED folds to `false` and every branch
 * guarded by it is dropped as dead code. The flag cannot be turned on in a
 * production bundle by setting an env var.
 *
 * Scope: this fakes the *session* only. Requests to the API still go out and
 * still fail while the backend is down — the shell, nav, and role-gated
 * routes render, but data-backed views will show their error/empty states.
 */

export const DEV_AUTH_ENABLED =
  import.meta.env.DEV && import.meta.env.VITE_DEV_AUTH === '1';

const DEV_AUTH_ROLE = (import.meta.env.VITE_DEV_AUTH_ROLE as string) || 'admin';

/** Shape matches AuthContext's UserProfile. */
export function makeDevUser() {
  return {
    id: 'dev-user-0000-0000-0000-000000000000',
    display_name: 'Dev Explorer',
    identity_key: '02'.padEnd(66, '0'),
    role: DEV_AUTH_ROLE,
    email: 'dev@localhost',
    country: 'United States',
    state: 'Vermont',
    city: 'Burlington',
    points: 1234,
    submission_count: 42,
    last_submission: new Date().toISOString(),
  };
}

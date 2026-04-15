import { test as base, expect, type Page } from '@playwright/test';

// ── Test user profiles ──────────────────────────────────────────────────────

export const CONTRIBUTOR_PROFILE = {
  id: 'aaaaaaaa-0000-0000-0000-000000000001',
  display_name: 'Test Contributor',
  identity_key: null,
  email: null,
  country: null,
  state: null,
  city: null,
  points: 42,
  submission_count: 5,
  last_submission: '2026-04-10T12:00:00.000Z',
  roles: ['contributor'],
};

export const ADMIN_PROFILE = {
  ...CONTRIBUTOR_PROFILE,
  id: 'aaaaaaaa-0000-0000-0000-000000000002',
  display_name: 'Test Admin',
  roles: ['admin', 'contributor'],
};

// ── Route mock helper ───────────────────────────────────────────────────────

async function mockAuthRoutes(page: Page, profile: typeof CONTRIBUTOR_PROFILE) {
  // Silent refresh on app mount → returns a fake access token
  await page.route('**/api/auth/refresh', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ access_token: 'test-access-token' }),
    })
  );

  // Profile fetch → returns the test user
  await page.route('**/api/users/me', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(profile),
    })
  );
}

// ── Fixtures ────────────────────────────────────────────────────────────────

type AuthFixtures = {
  /** Authenticated as a contributor */
  authedPage: Page;
  /** Authenticated as an admin */
  adminPage: Page;
};

export const test = base.extend<AuthFixtures>({
  authedPage: async ({ page }, use) => {
    await mockAuthRoutes(page, CONTRIBUTOR_PROFILE);
    await use(page);
  },

  adminPage: async ({ page }, use) => {
    await mockAuthRoutes(page, ADMIN_PROFILE);
    await use(page);
  },
});

export { expect };

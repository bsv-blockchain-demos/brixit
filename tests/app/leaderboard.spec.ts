import { test, expect } from '../fixtures/auth';
import { mockLeaderboards, MOCK_CROPS } from '../fixtures/api';

test.describe('Leaderboard', () => {
  test.beforeEach(async ({ authedPage }) => {
    await mockLeaderboards(authedPage);
    // LocationSelector mounts and fetches countries/states for its dropdowns
    await authedPage.route('**/api/geonames/**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
    // Crop filter dropdown in the sidebar
    await authedPage.route('**/api/crops', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_CROPS) })
    );
    await authedPage.goto('/leaderboard');
  });

  // The page renders responsive (mobile + desktop) layouts, so several texts
  // resolve to >1 element — scope with .first() to avoid strict-mode violations.
  test('renders the three leaderboard cards', async ({ authedPage }) => {
    await expect(authedPage.getByRole('heading', { name: 'Top Locations' }).first()).toBeVisible();
    await expect(authedPage.getByRole('heading', { name: 'Top Brands' }).first()).toBeVisible();
    await expect(authedPage.getByRole('heading', { name: 'Most Submissions' }).first()).toBeVisible();
  });

  test('displays brand entries from mock data', async ({ authedPage }) => {
    await expect(authedPage.getByText('Loading leaderboards...')).not.toBeVisible({ timeout: 5000 });
    await expect(authedPage.getByText("Olivia's Organics").filter({ visible: true }).first()).toBeVisible();
  });

  test('scores display as percentage not raw BRIX', async ({ authedPage }) => {
    await expect(authedPage.getByText('Loading leaderboards...')).not.toBeVisible({ timeout: 5000 });
    // Score badges must contain % — raw BRIX floats like "16.1" should not appear as score badges
    const scoreBadges = authedPage.locator('text=/%/').filter({ visible: true });
    await expect(scoreBadges.first()).toBeVisible();
    await expect(authedPage.getByText('16.1', { exact: true })).toHaveCount(0);
  });

  test('outlier scores show 100%+ not a number above 100', async ({ authedPage }) => {
    await expect(authedPage.getByText('Loading leaderboards...')).not.toBeVisible({ timeout: 5000 });
    // No score badge should show a number larger than 100 followed by %
    await expect(authedPage.getByText(/1[0-9]{2}%/)).not.toBeVisible();
  });

  test('Most Submissions leaderboard shows submission counts', async ({ authedPage }) => {
    await expect(authedPage.getByText('Loading leaderboards...')).not.toBeVisible({ timeout: 5000 });
    // Scope to <main> — "Test Contributor" also appears in the header user menu.
    const main = authedPage.getByRole('main');
    await expect(main.getByText('Test Contributor').filter({ visible: true }).first()).toBeVisible();
    await expect(main.getByText('5 submissions', { exact: true }).filter({ visible: true }).first()).toBeVisible();
  });

  test('unauthenticated user is redirected to the landing page', async ({ page }) => {
    await page.route('**/api/auth/refresh', route =>
      route.fulfill({ status: 401, body: '{}' })
    );
    await page.goto('/leaderboard');
    // ProtectedRoute sends unauthenticated visitors to '/'.
    await expect(page).toHaveURL(/\/$/);
  });
});

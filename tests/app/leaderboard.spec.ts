import { test, expect } from '../fixtures/auth';
import { mockLeaderboards } from '../fixtures/api';

test.describe('Leaderboard', () => {
  test.beforeEach(async ({ authedPage }) => {
    await mockLeaderboards(authedPage);
    await authedPage.goto('/leaderboard');
  });

  test('renders the three leaderboard cards', async ({ authedPage }) => {
    await expect(authedPage.getByText('Top Locations')).toBeVisible();
    await expect(authedPage.getByText('Top Brands')).toBeVisible();
    await expect(authedPage.getByText('Most Submissions')).toBeVisible();
  });

  test('displays brand entries from mock data', async ({ authedPage }) => {
    await expect(authedPage.getByText('Loading leaderboards...')).not.toBeVisible({ timeout: 5000 });
    await expect(authedPage.getByText("Olivia's Organics")).toBeVisible();
  });

  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.route('**/api/auth/refresh', route =>
      route.fulfill({ status: 401, body: '{}' })
    );
    await page.goto('/leaderboard');
    await expect(page).toHaveURL(/\/login/);
  });
});

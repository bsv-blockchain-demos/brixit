import { test, expect } from '@playwright/test';

test.describe('Login page', () => {
  test('renders the landing page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText(/real food\. real nutrition\./i)).toBeVisible();
    await expect(page.getByRole('button', { name: /start tracking my food/i })).toBeVisible();
  });

  test('shows desktop wallet button on desktop', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: /connect with desktop wallet/i })).toBeVisible();
  });

  test('shows phone connect option on desktop', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: /connect with my phone/i })).toBeVisible();
  });

  test('hides phone connect option on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/login');
    await expect(page.getByRole('button', { name: /connect with my phone/i })).not.toBeVisible();
  });

  test('FAQ navigates to faq page', async ({ page }) => {
    await page.goto('/login');
    // "FAQ" is a footer button
    await page.getByRole('button', { name: /faq/i }).click();
    await expect(page).toHaveURL(/\/faq/);
  });
});

test.describe('FAQ page', () => {
  test('renders all info sections', async ({ page }) => {
    await page.goto('/faq');
    await expect(page.getByText(/what is brix/i)).toBeVisible();
    await expect(page.getByText(/what is a wallet/i)).toBeVisible();
    await expect(page.getByText(/what is a certificate/i)).toBeVisible();
    await expect(page.getByText(/what is the mycelia app/i)).toBeVisible();
  });

  test('back button returns to login', async ({ page }) => {
    // Navigate from /login so history is set correctly
    await page.goto('/login');
    await page.getByRole('button', { name: /faq/i }).click();
    await expect(page).toHaveURL(/\/faq/);
    await page.getByRole('button', { name: /back/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Wallet error page', () => {
  test('renders error heading', async ({ page }) => {
    await page.goto('/wallet-error');
    await expect(page.getByText(/couldn't connect to your device/i)).toBeVisible();
  });

  test('shows Mycelia install prompt', async ({ page }) => {
    await page.goto('/wallet-error');
    await expect(page.getByText(/mycelia/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /install here/i })).toBeVisible();
  });

  test('shows mobile QR option on desktop', async ({ page }) => {
    await page.goto('/wallet-error');
    await expect(page.getByText(/connect via mobile qr/i)).toBeVisible();
  });

  test('hides mobile QR option on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/wallet-error');
    await expect(page.getByText(/connect via mobile qr/i)).not.toBeVisible();
  });
});

test.describe('Authenticated redirect', () => {
  test('redirects to leaderboard when already logged in', async ({ page }) => {
    await page.route('**/api/auth/refresh', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'tok' }) })
    );
    await page.route('**/api/users/me', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        id: 'x', display_name: 'User', identity_key: null, email: null,
        country: null, state: null, city: null, points: 0, submission_count: 0,
        last_submission: null, roles: ['contributor'],
      })})
    );
    await page.route('**/api/leaderboards/**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
    await page.goto('/login');
    await expect(page).toHaveURL(/\/leaderboard/);
  });
});

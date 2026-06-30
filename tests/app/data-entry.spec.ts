import { test, expect } from '../fixtures/auth';
import { mockStaticData } from '../fixtures/api';
import type { Page } from '@playwright/test';

// The data-entry form is a 2-step wizard: Step 1 "Where did you shop?"
// (location, purchase type, date) → "Next: Crops →" → Step 2 "What did you
// measure?" (crop reading cards). Typing into the location field is enough to
// satisfy the location requirement — latitude stays 0, so no venue prompt.
async function advanceToCropsStep(page: Page) {
  // Set POS + date first; type the location LAST so its autocomplete dropdown
  // (anchored under the field at the top) can't overlay the pills. "Next" lives
  // in the fixed bottom footer, clear of the dropdown.
  await page.getByRole('button', { name: 'Supermarket' }).click();
  await page.locator('#purchaseDate').fill('2026-06-20');
  await page.getByPlaceholder('Enter an address or store name').fill('Test Market');
  await page.getByRole('button', { name: /next: crops/i }).click();
}

test.describe('Data entry — Step 1 (shop)', () => {
  test.beforeEach(async ({ authedPage }) => {
    await mockStaticData(authedPage);
    // Keep the location autocomplete quiet (no dropdown over the form) so typing
    // is enough. LocationSearch queries Mapbox Search directly.
    await authedPage.route('https://api.mapbox.com/**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ suggestions: [] }) }),
    );
    await authedPage.goto('/data-entry');
    await expect(authedPage.getByText('Loading form data...')).not.toBeVisible({ timeout: 5000 });
  });

  test('renders the shop step', async ({ authedPage }) => {
    await expect(authedPage.getByRole('heading', { name: /new measurement entry/i }).first()).toBeVisible();
    await expect(authedPage.getByRole('heading', { name: /where did you shop/i })).toBeVisible();
  });

  test('renders the purchase-type pills', async ({ authedPage }) => {
    await expect(authedPage.getByRole('button', { name: 'Supermarket' })).toBeVisible();
    await expect(authedPage.getByRole('button', { name: 'Farmers Market' })).toBeVisible();
    await expect(authedPage.getByRole('button', { name: 'Farm Direct' })).toBeVisible();
    await expect(authedPage.getByRole('button', { name: 'Online' })).toBeVisible();
    await expect(authedPage.getByRole('button', { name: 'Other', exact: true })).toBeVisible();
  });

  test('Next surfaces a location error when the field is empty', async ({ authedPage }) => {
    await authedPage.getByRole('button', { name: /next: crops/i }).click();
    await expect(authedPage.getByText(/please enter a location/i)).toBeVisible();
  });

  test('selecting a purchase-type pill clears its validation error', async ({ authedPage }) => {
    await authedPage.getByRole('button', { name: /next: crops/i }).click();
    await expect(authedPage.getByText(/please select a purchase type/i)).toBeVisible();
    await authedPage.getByRole('button', { name: 'Supermarket' }).click();
    await expect(authedPage.getByText(/please select a purchase type/i)).not.toBeVisible();
  });
});

test.describe('Data entry — Step 2 (crops)', () => {
  test.beforeEach(async ({ authedPage }) => {
    await mockStaticData(authedPage);
    await authedPage.route('**/api/geonames/**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );
    await authedPage.goto('/data-entry');
    await expect(authedPage.getByText('Loading form data...')).not.toBeVisible({ timeout: 5000 });
    await advanceToCropsStep(authedPage);
    await expect(authedPage.getByRole('heading', { name: /what did you measure/i })).toBeVisible();
  });

  test('crop combobox trigger shows placeholder', async ({ authedPage }) => {
    // First reading accordion is open by default
    await expect(authedPage.getByRole('combobox').filter({ hasText: /select crop type/i })).toBeVisible();
  });

  test('crop combobox displays human-readable labels', async ({ authedPage }) => {
    await authedPage.getByRole('combobox').filter({ hasText: /select crop type/i }).click();
    await expect(authedPage.getByRole('option', { name: 'Bell Peppers' })).toBeVisible();
    await expect(authedPage.getByText('bell_pepper', { exact: true })).toHaveCount(0);
  });

  test('selecting a crop updates the trigger button', async ({ authedPage }) => {
    await authedPage.getByRole('combobox').filter({ hasText: /select crop type/i }).click();
    await authedPage.getByRole('option', { name: 'Bell Peppers' }).click();
    await expect(authedPage.getByRole('combobox').filter({ hasText: /bell peppers/i })).toBeVisible();
  });

  test('Add another crop button adds a second reading', async ({ authedPage }) => {
    // Remove buttons are hidden when only one reading exists
    await expect(authedPage.getByRole('button', { name: 'Remove reading', exact: true })).toHaveCount(0);
    await authedPage.getByRole('button', { name: /add another crop/i }).click();
    await expect(authedPage.getByRole('button', { name: 'Remove reading', exact: true })).toHaveCount(2);
  });

  test('shows global validation error when no crop is selected', async ({ authedPage }) => {
    await authedPage.getByRole('button', { name: /submit reading/i }).click();
    await expect(authedPage.getByText(/please fill in at least one crop reading/i)).toBeVisible();
  });

  test('shows validation error for missing brand when submitting', async ({ authedPage }) => {
    // Brand validation only runs for readings that have a crop selected —
    // select a crop first so the reading is included in validation
    await authedPage.getByRole('combobox').filter({ hasText: /select crop type/i }).click();
    await authedPage.getByRole('option', { name: 'Bell Peppers' }).click();
    await authedPage.getByRole('button', { name: /submit reading/i }).click();
    await expect(authedPage.getByText(/please select a brand, or choose unknown/i)).toBeVisible();
  });
});

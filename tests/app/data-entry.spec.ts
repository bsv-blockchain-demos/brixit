import { test, expect } from '../fixtures/auth';
import { mockStaticData } from '../fixtures/api';

test.describe('Data entry form', () => {
  test.beforeEach(async ({ authedPage }) => {
    await mockStaticData(authedPage);
    await authedPage.goto('/data-entry');
    await expect(authedPage.getByText('Loading form data...')).not.toBeVisible({ timeout: 5000 });
  });

  test('renders the submission form', async ({ authedPage }) => {
    await expect(authedPage.getByText('Submit BRIX Measurement')).toBeVisible();
    // Use label element to avoid matching the combobox placeholder text
    await expect(authedPage.locator('label').filter({ hasText: /crop type/i })).toBeVisible();
    await expect(authedPage.locator('label').filter({ hasText: /farm \/ brand name/i })).toBeVisible();
  });

  test('shows validation error when submitting without crop', async ({ authedPage }) => {
    await authedPage.getByRole('button', { name: /submit measurement/i }).click();
    await expect(authedPage.getByText(/please select crop type/i)).toBeVisible();
  });

  test('crop combobox trigger shows placeholder', async ({ authedPage }) => {
    // Filter by text content since accessible name computation doesn't match placeholder
    await expect(authedPage.getByRole('combobox').filter({ hasText: /select crop type/i })).toBeVisible();
  });

  test('crop combobox displays human-readable labels', async ({ authedPage }) => {
    await authedPage.getByRole('combobox').filter({ hasText: /select crop type/i }).click();
    // Should show label, not raw db name
    await expect(authedPage.getByRole('option', { name: 'Bell Peppers' })).toBeVisible();
    await expect(authedPage.getByText('bell_pepper', { exact: true })).not.toBeVisible();
  });

  test('selecting a crop updates the trigger button', async ({ authedPage }) => {
    await authedPage.getByRole('combobox').filter({ hasText: /select crop type/i }).click();
    await authedPage.getByRole('option', { name: 'Bell Peppers' }).click();
    await expect(authedPage.getByRole('combobox').filter({ hasText: /bell peppers/i })).toBeVisible();
  });
});

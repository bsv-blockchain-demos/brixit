import { test, expect } from '../fixtures/auth';
import { mockStaticData } from '../fixtures/api';

test.describe('Data entry form', () => {
  test.beforeEach(async ({ authedPage }) => {
    await mockStaticData(authedPage);
    await authedPage.goto('/data-entry');
    await expect(authedPage.getByText('Loading form data...')).not.toBeVisible({ timeout: 5000 });
  });

  test('renders the submission form', async ({ authedPage }) => {
    await expect(authedPage.getByRole('heading', { name: /submit brix reading/i })).toBeVisible();
    await expect(authedPage.getByText('Where did you shop?')).toBeVisible();
    await expect(authedPage.getByText('What did you measure?')).toBeVisible();
  });

  test('renders required section labels', async ({ authedPage }) => {
    await expect(authedPage.locator('label').filter({ hasText: /farm \/ brand name/i })).toBeVisible();
    await expect(authedPage.locator('label').filter({ hasText: /location/i })).toBeVisible();
    await expect(authedPage.getByText('Purchase Type')).toBeVisible();
  });

  test('renders POS type pills', async ({ authedPage }) => {
    await expect(authedPage.getByRole('button', { name: 'Supermarket' })).toBeVisible();
    await expect(authedPage.getByRole('button', { name: 'Farmers Market' })).toBeVisible();
    await expect(authedPage.getByRole('button', { name: 'Farm Direct' })).toBeVisible();
    await expect(authedPage.getByRole('button', { name: 'Online' })).toBeVisible();
    await expect(authedPage.getByRole('button', { name: 'Other' })).toBeVisible();
  });

  test('selecting a POS pill clears its validation error', async ({ authedPage }) => {
    await authedPage.getByRole('button', { name: /submit reading/i }).click();
    await expect(authedPage.getByText(/please select a purchase type/i)).toBeVisible();
    await authedPage.getByRole('button', { name: 'Supermarket' }).click();
    await expect(authedPage.getByText(/please select a purchase type/i)).not.toBeVisible();
  });

  test('crop combobox trigger shows placeholder', async ({ authedPage }) => {
    await expect(authedPage.getByRole('combobox').filter({ hasText: /select crop type/i })).toBeVisible();
  });

  test('crop combobox displays human-readable labels', async ({ authedPage }) => {
    await authedPage.getByRole('combobox').filter({ hasText: /select crop type/i }).click();
    await expect(authedPage.getByRole('option', { name: 'Bell Peppers' })).toBeVisible();
    await expect(authedPage.getByText('bell_pepper', { exact: true })).not.toBeVisible();
  });

  test('selecting a crop updates the trigger button', async ({ authedPage }) => {
    await authedPage.getByRole('combobox').filter({ hasText: /select crop type/i }).click();
    await authedPage.getByRole('option', { name: 'Bell Peppers' }).click();
    await expect(authedPage.getByRole('combobox').filter({ hasText: /bell peppers/i })).toBeVisible();
  });

  test('Add another crop button adds a second reading', async ({ authedPage }) => {
    // Remove buttons are hidden when only one reading exists
    await expect(authedPage.getByRole('button', { name: /remove reading/i })).not.toBeVisible();
    await authedPage.getByRole('button', { name: /add another crop/i }).click();
    // Both readings now show a remove button
    await expect(authedPage.getByRole('button', { name: /remove reading/i })).toHaveCount(2);
  });

  test('submit button shows plural count with multiple readings', async ({ authedPage }) => {
    await authedPage.getByRole('button', { name: /add another crop/i }).click();
    await expect(authedPage.getByRole('button', { name: /submit 2 readings/i })).toBeVisible();
  });

  test('shows global validation error when no crop is selected', async ({ authedPage }) => {
    await authedPage.getByRole('button', { name: /submit reading/i }).click();
    await expect(authedPage.getByText(/please fill in at least one crop reading/i)).toBeVisible();
  });

  test('shows validation error for missing brand when submitting', async ({ authedPage }) => {
    await authedPage.getByRole('button', { name: /submit reading/i }).click();
    await expect(authedPage.getByText(/please select a farm or brand/i)).toBeVisible();
  });
});

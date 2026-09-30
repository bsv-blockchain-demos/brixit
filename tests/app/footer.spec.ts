import { test, expect } from '@playwright/test';

const MOBILE = { width: 390, height: 844 };

/** True when two rendered boxes share any pixel — i.e. one is painted over the other. */
function overlaps(
  a: { x: number; y: number; width: number; height: number } | null,
  b: { x: number; y: number; width: number; height: number } | null,
): boolean {
  if (!a || !b) return false;
  return (
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
  );
}

test.describe('Landing footer on mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');
  });

  test('primary and legal links do not overlap', async ({ page }) => {
    // The footer was a fixed 3-column grid at every width, so the middle column
    // overflowed its cell and printed "Contact" on top of "Privacy".
    const footer = page.getByRole('contentinfo');
    const contact = footer.getByRole('button', { name: 'Contact' });
    const privacy = footer.getByRole('link', { name: 'Privacy' });

    await expect(contact).toBeVisible();
    await expect(privacy).toBeVisible();

    expect(overlaps(await contact.boundingBox(), await privacy.boundingBox())).toBe(false);
  });

  test('links stay inside the viewport', async ({ page }) => {
    const footer = page.getByRole('contentinfo');
    for (const name of ['What is Brix?', 'Privacy', 'Terms']) {
      const box = await footer.getByText(name, { exact: true }).first().boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(MOBILE.width);
    }
  });
});

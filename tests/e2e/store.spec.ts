import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
for (const locale of ['ar', 'en'])
  test(`Store remains unavailable without operational authority ${locale}`, async ({ page }) => {
    await page.goto('/' + locale + '/store');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      locale === 'ar' ? 'متجر نقل 365' : 'Naql365 Store',
    );
    await expect(
      page.getByRole('heading', {
        name: locale === 'ar' ? 'المتجر غير متاح حاليًا' : 'Store currently unavailable',
      }),
    ).toBeVisible();
    await expect(page.locator('.store-product')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    expect(
      (await new AxeBuilder({ page }).include('.store-experience').analyze()).violations,
    ).toEqual([]);
  });

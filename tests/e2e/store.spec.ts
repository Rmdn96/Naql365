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
for (const locale of ['ar', 'en'])
  test(`Homepage presents Transport and Store while checkout remains governed ${locale}`, async ({
    page,
    isMobile,
  }) => {
    await page.goto('/' + locale);
    await expect(page.locator('.launch-hero a[href="/' + locale + '/store"]')).toBeVisible();
    await expect(page.locator('.store-introduction h2')).toHaveText(
      locale === 'ar'
        ? 'خدمات النقل ومستلزمات التغليف في مكان واحد'
        : 'Transport and packing supplies, together',
    );
    await expect(page.locator('.store-introduction .store-product')).toHaveCount(0);
    if (isMobile) {
      await page
        .getByRole('button', { name: locale === 'ar' ? 'القائمة' : 'Menu', exact: true })
        .click();
      await expect(page.locator('.mobile-menu a[href="/' + locale + '/store"]')).toBeVisible();
    } else
      await expect(
        page.locator('.desktop-header-nav a[href="/' + locale + '/store"]'),
      ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
  });

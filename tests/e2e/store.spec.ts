import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
for (const locale of ['ar', 'en'])
  test(`Store remains unavailable without operational authority ${locale}`, async ({ page }) => {
    await page.goto('/' + locale + '/store');
    await expect(page.locator('.cm-section-heading h2').first()).toHaveText(
      locale === 'ar' ? 'مستلزمات التغليف' : 'Packing supplies',
    );
    await expect(
      page
        .getByText(
          locale === 'ar'
            ? 'المتجر قيد التجهيز — البيع غير متاح'
            : 'Purchasing is currently unavailable until commercial authority is approved',
          { exact: true },
        )
        .last(),
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
    await expect(
      page.locator('.cm-section-heading a[href="/' + locale + '/store"]').first(),
    ).toBeVisible();
    await expect(page.locator('.cm-section-heading h2').first()).toHaveText(
      locale === 'ar' ? 'كل ما تحتاجه للخطوة القادمة' : 'Everything for your next move',
    );
    await expect(page.locator('.cm-product.store-product')).toHaveCount(0);
    if (isMobile) {
      await page
        .getByRole('button', { name: locale === 'ar' ? 'القائمة' : 'Menu', exact: true })
        .click();
      await expect(
        page.locator('[role=dialog] a[href="/' + locale + '/store"]').first(),
      ).toBeVisible();
    } else
      await expect(
        page.locator('.cm-navigation nav a[href="/' + locale + '/store"]').first(),
      ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
  });

for (const locale of ['ar', 'en'])
  test('Original category navigation uses the canonical screen ' + locale, async ({ page }) => {
    await page.goto('/' + locale + '/store/categories');
    await expect(page.locator('.cm-section-heading h2').first()).toHaveText(
      locale === 'ar' ? 'الفئات' : 'Categories',
    );
    await expect(page.locator('.cm-section-heading h2').first()).toBeVisible();
    // A paused catalog has no approved categories; its empty grid has no visual area.
    await expect(page.locator('.cm-categories')).toHaveCount(1);
    await expect(page.locator('.cm-categories a')).toHaveCount(0);
    await expect(page.locator('.cm-product.store-product')).toHaveCount(0);
    await expect(page.locator('.cm-lab')).toContainText(
      locale === 'ar' ? 'البيع غير متاح' : 'Purchasing is currently unavailable',
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
  });

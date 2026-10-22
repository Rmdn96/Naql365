import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const locale of ['ar', 'en'] as const) {
  test(`${locale} Customer unavailable state keeps the source workspace without exposing account data`, async ({
    page,
  }) => {
    await page.goto(`/${locale}/account`);
    const root = page.locator('.customer-workspace');
    await expect(root).toBeVisible();
    await expect(page.locator('.site-header,.transport-header,.cm-header')).toHaveCount(0);
    await expect(root.locator('.brand-mark')).toHaveCount(1);
    await expect(root.locator('#customer-content h1')).toBeVisible();
    await expect(root.locator('form.profile-form')).toHaveCount(0);
    await expect(root.locator('a[href="/' + locale + '/account/quotes"]')).toHaveCount(1);
    await expect(root.locator('a[href="/' + locale + '/store/orders"]')).toHaveCount(1);
    await page.keyboard.press('Tab');
    await expect(root.locator('.skip-link')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(root.locator('#customer-content')).toBeFocused();
    for (const theme of ['light', 'dark', 'system']) {
      await page
        .getByRole('combobox', { name: locale === 'ar' ? 'المظهر' : 'Theme', exact: true })
        .selectOption(theme);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      for (const width of [360, 390, 768, 1280, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
      }
      expect(
        (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
          .violations,
      ).toEqual([]);
    }
    await root.locator('.language-link').click();
    const other = locale === 'ar' ? 'en' : 'ar';
    await expect(page).toHaveURL(new RegExp('/' + other + '/account$'));
    await expect(page.locator('html')).toHaveAttribute('dir', other === 'ar' ? 'rtl' : 'ltr');
    await page
      .getByRole('link', {
        name: other === 'ar' ? 'طلب نقل جديد' : 'New transport request',
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(new RegExp('/' + other + '/request$'));
    await expect(page.locator('.transport-header .brand-mark')).toHaveCount(1);
    await expect(page.locator('.customer-workspace')).toHaveCount(0);
  });
}

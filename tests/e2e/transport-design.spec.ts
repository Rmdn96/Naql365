import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const locale of ['ar', 'en'] as const) {
  test(`${locale} Transport landing preserves real request and secure tracking routes`, async ({
    page,
  }) => {
    await page.goto(`/${locale}/transport`);
    await expect(page.locator('.transport-hero h1')).toBeVisible();
    await expect(page.locator('.transport-hero a').first()).toHaveAttribute(
      'href',
      `/${locale}/request`,
    );
    await expect(page.locator('.transport-hero a').nth(1)).toHaveAttribute(
      'href',
      `/${locale}/guest`,
    );
    await expect(page.locator('.transport-service-grid').first().locator('article')).toHaveCount(0);
    await expect(page.locator('.transport-section [role=status]')).toBeVisible();
    await expect(page.locator('.site-header, .site-footer')).toHaveCount(0);
    for (const theme of ['light', 'dark', 'system']) {
      await page
        .context()
        .addCookies([{ name: 'naql365_theme', value: theme, url: 'http://127.0.0.1:3000' }]);
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      const nativeScheme =
        theme === 'system'
          ? (await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches))
            ? 'dark'
            : 'light'
          : theme;
      await expect(page.locator('.transport-experience')).toHaveCSS('color-scheme', nativeScheme);
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
  });

  test(`${locale} request retains Guest controls, branding and independent Auth navigation`, async ({
    page,
  }) => {
    await page.goto(`/${locale}/request`);
    await expect(page.locator('#guest-country')).toBeVisible();
    await expect(page.locator('.launch-header .brand-mark')).toBeVisible();
    await expect(page.locator('.site-header')).toHaveCount(0);
    await expect(page.locator('#guest-country')).toHaveValue('EG');
    await page.keyboard.press('Tab');
    await expect(page.locator('.skip-link[href="#main"]')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeFocused();
    await page.locator('.launch-header-tools a[href="/' + locale + '/login"]').click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/login`));
    await expect(page.locator('.auth-v2')).toBeVisible();
    await expect(page.locator('.transport-header')).toHaveCount(0);
  });
}

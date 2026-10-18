import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const locale of ['ar', 'en']) {
  test(`${locale} secure Guest continuation uses Customer V2 themes without granting reference access`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    for (const theme of ['light', 'dark', 'system']) {
      await page
        .context()
        .addCookies([{ name: 'naql365_theme', value: theme, url: 'http://127.0.0.1:3000' }]);
      await page.goto(`/${locale}/guest`);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
      await expect(page.locator('main [role=alert]')).toBeVisible();
      await expect(page.locator('main input')).toHaveCount(0);
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
}

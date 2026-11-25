import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
for (const locale of ['ar', 'en']) {
  test(`${locale} Stage 1 navigation, responsive hierarchy and safe locale context`, async ({
    page,
  }) => {
    for (const width of [360, 390, 768, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${locale}`);
      await expect(page.locator('h1')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(
        (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
          .violations,
      ).toEqual([]);
      const links = page.locator('.launch-main-nav a');
      await expect(links).toHaveCount(4);
      for (const link of await links.all()) await expect(link).toBeVisible();
    }
    await page.goto(`/${locale}/recover#private-fragment-must-not-propagate`);
    const link = page.getByRole('link', {
      name: locale === 'ar' ? 'English' : 'العربية',
      exact: true,
    });
    await expect(link).toHaveAttribute('href', `/${locale === 'ar' ? 'en' : 'ar'}/recover`);
    await link.click();
    await expect(page).not.toHaveURL(/private-fragment/);
  });
}

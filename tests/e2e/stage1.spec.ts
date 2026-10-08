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
      const menu = page.getByRole('button', {
        name: locale === 'ar' ? 'القائمة' : 'Menu',
        exact: true,
      });
      if (width <= 1100) {
        await menu.click();
        await expect(page.getByRole('dialog')).toBeVisible();
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        await page.keyboard.press('Escape');
        await expect(menu).toBeFocused();
      }
    }
    await page.goto(`/${locale}/recover#private-fragment-must-not-propagate`);
    const link = page.locator('.desktop-header-nav .language-link');
    await expect(link).toHaveAttribute('href', `/${locale === 'ar' ? 'en' : 'ar'}/recover`);
    await link.click();
    await expect(page).not.toHaveURL(/private-fragment/);
  });
}

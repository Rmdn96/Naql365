import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
for (const locale of ['ar', 'en'])
  test(
    locale + ' Driver unavailable view retains branded accessible isolation',
    async ({ page }) => {
      await page.goto('/' + locale + '/driver');
      const root = page.locator('.driver-workspace');
      await expect(root).toBeVisible();
      await expect(root).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
      await expect(root.locator('.brand-mark')).toHaveCount(1);
      await expect(
        page.locator('.site-header,.site-footer,.cm-header,.staff-app,.customer-workspace'),
      ).toHaveCount(0);
      await expect(root.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(root.locator('.driver-command,.driver-pod')).toHaveCount(0);
      await page.keyboard.press('Tab');
      await expect(root.locator('.skip-link')).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(root.locator('#driver-content')).toBeFocused();
      for (const theme of ['light', 'dark', 'system']) {
        await root
          .getByRole('combobox', { name: locale === 'ar' ? 'المظهر' : 'Theme', exact: true })
          .selectOption(theme);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        for (const width of [360, 390, 768, 1280, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          ).toBe(true);
        }
        expect(
          (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
            .violations,
        ).toEqual([]);
      }
    },
  );

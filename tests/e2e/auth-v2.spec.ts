import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const locale of ['ar', 'en']) {
  test(`${locale} authentication presentation and safe callback failure across viewports`, async ({
    page,
  }) => {
    for (const path of ['login', 'register', 'recover']) {
      await page.goto(`/${locale}/${path}`);
      await expect(page.locator('.auth-v2 h1')).toHaveCount(1);
      for (const width of [360, 390, 768, 1280, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        expect(
          await page
            .locator('.floating-contact')
            .evaluate((element) => getComputedStyle(element).position),
        ).toBe('static');
      }
      expect(
        (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
          .violations,
      ).toEqual([]);
    }
    await page.goto(`/auth/callback?locale=${locale}`);
    await expect(page).toHaveURL(new RegExp(`/${locale}/login\\?notice=confirmation-link$`));
    await expect(page.locator('.auth-v2 [role=alert]')).toBeVisible();
    expect(await page.locator('main').innerText()).not.toMatch(/JWT|sb_secret_|stack trace/);
  });
}

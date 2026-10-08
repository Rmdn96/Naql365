import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const locale of ['ar', 'en'] as const) {
  test(`${locale} customer payment explanation and secure continuation remain accessible`, async ({
    page,
  }) => {
    await page.goto(`/${locale}`);
    const payment = page.locator('.launch-payment-info');
    await expect(payment).toBeVisible();
    await expect(payment).toContainText(
      locale === 'ar' ? 'انتظر تأكيد المالية' : 'wait for Finance confirmation',
    );
    await expect(payment).not.toContainText(/IBAN|SA\d{22}|sb_secret_/);
    for (const width of [360, 390, 768, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await page.locator('.hero-track').click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/guest$`));
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.locator('main input')).toHaveCount(0);
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
  });
}

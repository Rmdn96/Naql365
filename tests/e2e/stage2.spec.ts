import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const locale of ['ar', 'en'] as const) {
  test(`${locale} customer payment explanation and secure continuation remain accessible`, async ({
    page,
  }) => {
    await page.goto(`/${locale}`);
    const catalog = page.locator('.launch-store');
    await expect(catalog).toContainText(
      locale === 'ar'
        ? 'نؤكد التوفر ورسوم التوصيل والإجمالي'
        : 'We confirm availability, delivery fees and the total',
    );
    await expect(catalog).not.toContainText(
      /IBAN|فودافون كاش|إنستاباي|Vodafone Cash|InstaPay|supplierEntitlementMinor|moneyOperations/i,
    );
    for (const width of [360, 390, 768, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await page.goto('/' + locale + '/transport');
    await page.locator('.transport-hero a[href="/' + locale + '/guest"]').click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/guest$`));
    await expect(page.locator('main').getByRole('alert')).toBeVisible();
    await expect(page.locator('main input')).toHaveCount(0);
    await expect(page).toHaveTitle(/Naql365|نقل/);
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
  });
}

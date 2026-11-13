import { expect, test } from '@playwright/test';
for (const locale of ['ar', 'en'])
  test(`${locale} legacy Saudi preference resolves to Egypt across navigation`, async ({
    page,
    context,
  }) => {
    await context.addCookies([
      { name: 'naql365_market', value: 'SA', url: 'http://127.0.0.1:3000' },
    ]);
    for (const path of [`/${locale}`, `/${locale === 'ar' ? 'en' : 'ar'}/login`]) {
      await page.goto(path);
      await expect(
        page
          .locator(
            '.market-control, select[aria-label="Service country"], select[aria-label="بلد الخدمة"]',
          )
          .first(),
      ).toContainText(/EG|🇪🇬/);
      await expect(page.locator('option[value="SA"]')).toHaveCount(0);
      await page.reload();
      await expect(
        page
          .locator(
            '.market-control, select[aria-label="Service country"], select[aria-label="بلد الخدمة"]',
          )
          .first(),
      ).toContainText(/EG|🇪🇬/);
    }
  });

import { expect, test } from '@playwright/test';
for (const locale of ['ar', 'en'])
  test(`${locale} legacy Saudi preference resolves to Egypt across navigation`, async ({
    page,
    context,
  }) => {
    await context.addCookies([
      { name: 'naql365_market', value: 'SA', url: 'http://127.0.0.1:3000' },
    ]);
    await page.goto('/' + locale);
    await expect(page.locator('#contact a[href^="https://wa.me/20"]')).toBeVisible();
    await page.reload();
    await expect(page.locator('#contact a[href^="https://wa.me/20"]')).toBeVisible();
    await page.goto('/' + (locale === 'ar' ? 'en' : 'ar') + '/login');
    await expect(page.locator('.market-control').first()).toContainText(/EG|🇪🇬/);
    await expect(page.locator('option[value="SA"]')).toHaveCount(0);
  });

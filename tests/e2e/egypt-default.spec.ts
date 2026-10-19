import { expect, test } from '@playwright/test';

for (const locale of ['ar', 'en']) {
  test(`${locale} fresh public visitor defaults to Egypt and retains an explicit preference`, async ({
    page,
  }) => {
    await page.goto(`/${locale}`);
    await expect(page.locator('#public-market')).toHaveValue('EG');
    await page.reload();
    await expect(page.locator('#public-market')).toHaveValue('EG');
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().endsWith('/api/public/market') &&
          response.request().method() === 'POST' &&
          response.status() === 200,
      ),
      page.locator('#public-market').selectOption('SA'),
    ]);
    await expect(page.locator('#public-market')).toHaveValue('SA');
    await page.goto(`/${locale === 'ar' ? 'en' : 'ar'}/login`);
    await expect(page.locator('#public-market')).toHaveValue('SA');
    await page.reload();
    await expect(page.locator('#public-market')).toHaveValue('SA');
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().endsWith('/api/public/market') &&
          response.request().method() === 'POST' &&
          response.status() === 200,
      ),
      page.locator('#public-market').selectOption('EG'),
    ]);
    await expect(page.locator('#public-market')).toHaveValue('EG');
  });
}

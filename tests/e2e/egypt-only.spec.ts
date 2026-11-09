import { expect, test } from '@playwright/test';
for (const locale of ['ar', 'en'] as const) {
  test(`Egypt-only ${locale} renders with a legacy Saudi cookie and rejects direct switching`, async ({
    page,
    context,
  }) => {
    await context.addCookies([
      { name: 'naql365_market', value: 'SA', url: 'http://127.0.0.1:3000' },
    ]);
    const response = await page.goto(`/${locale}`);
    expect(response?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
    await expect(page.locator('option[value="SA"]')).toHaveCount(0);
    await expect(
      page.locator('select[aria-label="Service country"],select[aria-label="بلد الخدمة"]'),
    ).toHaveValue('EG');
    const rejected = await page.request.post('/api/public/market', {
      headers: { Origin: 'http://127.0.0.1:3000' },
      data: { country: 'SA' },
    });
    expect(rejected.status()).toBe(400);
    const accepted = await page.request.post('/api/public/market', {
      headers: { Origin: 'http://127.0.0.1:3000' },
      data: { country: 'EG' },
    });
    expect(accepted.status()).toBe(200);
    await page.goto(`/${locale}/transport`);
    await expect(page.locator('option[value="SA"]')).toHaveCount(0);
  });
}

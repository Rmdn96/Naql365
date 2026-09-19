import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
for (const locale of ['ar', 'en']) {
  test(`${locale} Driver login is mobile accessible without public Driver signup`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto(`/${locale}/driver/login`);
    expect(response?.headers()['permissions-policy']).toContain('geolocation=(self)');
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('input[name=email]')).toHaveAttribute('autocomplete', 'email');
    await expect(page.locator('input[name=password]')).toHaveAttribute(
      'autocomplete',
      'current-password',
    );
    await expect(page.locator('main a[href$="/register"]')).toHaveCount(0);
    await page.locator('input[name=email]').focus();
    await page.keyboard.press('Tab');
    await expect(page.locator('input[name=password]')).toBeFocused();
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    const home = await page.goto(`/${locale}`);
    expect(home?.headers()['permissions-policy']).toContain('geolocation=()');
  });
}
test('Driver APIs reject untrusted origins and malformed commands', async ({ request }) => {
  const denied = await request.post('/api/driver', {
    headers: { Origin: 'https://untrusted.invalid' },
    data: { action: 'complete_trip' },
  });
  expect(denied.status()).toBe(403);
  const invalid = await request.post('/api/driver', {
    headers: { Origin: 'http://127.0.0.1:3000' },
    data: { action: 'reassign' },
  });
  expect(invalid.status()).toBe(400);
});

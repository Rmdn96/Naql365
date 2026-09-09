import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('root defaults to Arabic and language switch reaches English', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/ar$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.getByRole('link', { name: 'English' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
});
for (const locale of ['ar', 'en']) {
  test(`${locale} public page is accessible and has correct SEO`, async ({ page }) => {
    const response = await page.goto(`/${locale}`);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `http://127.0.0.1:3000/${locale}`,
    );
    expect(response?.headers()['content-security-policy']).toContain("object-src 'none'");
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
  test(`${locale} showcase and dialog keyboard behavior`, async ({ page }) => {
    await page.goto(`/${locale}/design-system`);
    const trigger = page.getByRole('button', {
      name: locale === 'ar' ? 'عرض الحوار' : 'Open dialog',
    });
    await trigger.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(trigger).toBeFocused();
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
  });
}
test('protected spaces fail closed without configured credentials', async ({ page }) => {
  for (const route of ['account', 'portal', 'driver']) {
    await page.goto(`/en/${route}`);
    await expect(page.getByRole('heading', { name: 'Service not configured yet' })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  }
});
test('unknown locale is not accepted', async ({ page }) => {
  const response = await page.goto('/fr');
  expect(response?.status()).toBe(404);
});
test('callback rejects external destinations when no valid code is present', async ({
  request,
}) => {
  const response = await request.get('/auth/callback?next=https://evil.example', {
    maxRedirects: 0,
  });
  expect(response.headers().location).toBe('http://127.0.0.1:3000/ar/login');
});

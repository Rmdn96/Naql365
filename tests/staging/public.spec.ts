import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures';

for (const locale of ['ar', 'en']) {
  test(`${locale} hosted public metadata, accessibility and responsive layout`, async ({
    page,
    baseURL,
  }) => {
    const response = await page.goto(`/${locale}`);
    expect(response?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('h1')).toBeVisible();
    await expect(page).toHaveTitle(/Naql365|نقل/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${baseURL}/${locale}`,
    );
    for (const language of ['ar', 'en']) {
      await expect(page.locator(`link[hreflang="${language}"]`)).toHaveAttribute(
        'href',
        `${baseURL}/${language}`,
      );
    }
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    expect(response?.headers()['x-robots-tag']).toContain('noindex');
    expect(response?.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(response?.headers()['x-content-type-options']).toBe('nosniff');
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
  });
}

test('hosted routing, crawler policy and callback rejection', async ({ page, baseURL }) => {
  await page.goto('/');
  await expect(page).toHaveURL(`${baseURL}/ar`);
  await page.getByRole('link', { name: 'English' }).click();
  await expect(page).toHaveURL(`${baseURL}/en`);
  await page.goto('/login');
  await expect(page).toHaveURL(`${baseURL}/ar/login`);
  await page.goto('/robots.txt');
  expect(await page.locator('body').innerText()).toContain('Disallow: /');
  const sitemap = await page.goto('/sitemap.xml');
  expect(await sitemap?.text()).not.toContain('<loc>');
  await page.goto('/auth/callback?next=https://evil.example');
  await expect(page).toHaveURL(`${baseURL}/ar/login`);
});

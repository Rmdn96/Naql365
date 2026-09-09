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
    const structured = await page.locator('script[type="application/ld+json"]').textContent();
    expect(structured && JSON.parse(structured)['@context'] === 'https://schema.org').toBe(true);
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

test('hosted browser assets contain no privileged test secrets or source maps', async ({
  page,
}) => {
  const privileged = [
    process.env.STAGING_TEST_ADMIN_KEY,
    process.env.STAGING_TEST_USER_PASSWORD,
  ].filter((value): value is string => !!value);
  expect(privileged.length).toBe(2);
  const response = await page.goto('/en');
  const html = await response?.text();
  expect(privileged.every((secret) => !html?.includes(secret))).toBe(true);
  const scripts = await page
    .locator('script[src]')
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('src')).filter((value): value is string => !!value),
    );
  expect(scripts.length > 0).toBe(true);
  const assets = await page.evaluate(async (sources) => {
    const assets: { ok: boolean; body: string }[] = [];
    for (const source of sources) {
      const asset = await fetch(source);
      const body = await asset.text();
      assets.push({ ok: asset.ok, body });
    }
    return assets;
  }, scripts);
  // Compare only in the Node test process; privileged values never enter the browser.
  expect(
    assets.every(
      (asset) =>
        asset.ok &&
        privileged.every((secret) => !asset.body.includes(secret)) &&
        !asset.body.includes('sb_secret_') &&
        !/sourceMappingURL=/.test(asset.body),
    ),
  ).toBe(true);
});

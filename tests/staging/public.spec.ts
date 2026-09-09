import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures';
import { hasSourceMapDirective } from '../helpers/source-map';

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
  baseURL,
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
  const assets: { ok: boolean; body: string }[] = [];
  // Inspect every DOM-observed script, including provider-injected tooling. Fetching the
  // latter inside the page is correctly denied by connect-src; keep CSP unchanged.
  for (const source of scripts) {
    const url = new URL(source, baseURL);
    expect([baseURL, 'https://vercel.live'].includes(url.origin)).toBe(true);
    const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    const headers =
      url.origin === baseURL && bypass ? { 'x-vercel-protection-bypass': bypass } : undefined;
    const asset = await fetch(url, headers ? { headers } : {});
    assets.push({ ok: asset.ok, body: await asset.text() });
  }
  // Compare only in the Node test process; privileged values never enter the browser.
  expect(
    assets.every(
      (asset) =>
        asset.ok &&
        privileged.every((secret) => !asset.body.includes(secret)) &&
        !asset.body.includes('sb_secret_') &&
        !hasSourceMapDirective(asset.body),
    ),
  ).toBe(true);
});

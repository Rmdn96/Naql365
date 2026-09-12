import { test, expect } from '../staging/fixtures';
import { customerDictionary } from '../../src/i18n/customer';
import { hasSourceMapDirective } from '../helpers/source-map';

test('authenticated operations assets preserve server-only secret boundaries', async ({
  page,
  baseURL,
}) => {
  const raw = process.env.STAGING_PHASE3_IDENTITIES;
  const adminKey = process.env.STAGING_TEST_ADMIN_KEY;
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (!raw || !adminKey || !bypass || !baseURL) throw new Error('Guarded fixture required');
  const identities = JSON.parse(raw) as Record<string, { email: string; password: string }>;
  const staff = identities.operations!;
  await page.goto('/en/login');
  await page.locator('#email').fill(staff.email);
  await page.locator('#password').fill(staff.password);
  await page.getByRole('button', { name: customerDictionary('en').login, exact: true }).click();
  await expect(page).toHaveURL(`${baseURL}/en/account`);
  const response = await page.goto('/en/portal/operations');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('main')).toHaveCount(1);
  expect(response?.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(response?.headers()['x-content-type-options']).toBe('nosniff');
  expect(response?.headers()['x-robots-tag']).toContain('noindex');
  const secrets = [adminKey, bypass, ...Object.values(identities).map((item) => item.password)];
  const html = await page.content();
  expect(secrets.every((value) => !html.includes(value))).toBe(true);
  const sources = await page
    .locator('script[src]')
    .evaluateAll((nodes) => nodes.map((node) => (node as HTMLScriptElement).src));
  expect(sources.length).toBeGreaterThan(0);
  for (const source of sources) {
    const url = new URL(source);
    expect([baseURL, 'https://vercel.live']).toContain(url.origin);
    const asset = await fetch(url, {
      headers: url.origin === baseURL ? { 'x-vercel-protection-bypass': bypass } : {},
      signal: AbortSignal.timeout(30000),
    });
    expect(asset.ok).toBe(true);
    const body = await asset.text();
    expect(secrets.every((value) => !body.includes(value))).toBe(true);
    expect(body.includes('sb_secret_')).toBe(false);
    expect(hasSourceMapDirective(body)).toBe(false);
  }
});

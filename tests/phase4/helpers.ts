import AxeBuilder from '@axe-core/playwright';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { test, expect } from '../staging/fixtures';
import { customerDictionary } from '../../src/i18n/customer';
import { quotesDictionary } from '../../src/i18n/quotes';
import { marketDate } from '../../src/domain/markets/model';
import type { Page } from '@playwright/test';
import type { OperationAction } from '../../src/domain/operations/model';
function required(key: string) {
  const value = process.env[key];
  if (!value) throw new Error('Missing guarded ' + key);
  return value;
}
export const org = required('STAGING_PHASE4_ORG');
export const identities = JSON.parse(required('STAGING_PHASE4_IDENTITIES')) as Record<
  string,
  { email: string; password: string; id: string }
>;
const boundedFetch: typeof fetch = (input, init) =>
  fetch(input, {
    ...init,
    signal: init?.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(30000)])
      : AbortSignal.timeout(30000),
  });
export const admin = createClient(
  required('STAGING_TEST_API_URL'),
  required('STAGING_TEST_ADMIN_KEY'),
  {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: boundedFetch },
  },
);
export async function login(page: Page, role: string, locale: 'ar' | 'en' = 'ar') {
  await page.goto(`/${locale}/login`);
  await page.locator('#email').fill(identities[role]!.email);
  await page.locator('#password').fill(identities[role]!.password);
  await page.getByRole('button', { name: customerDictionary(locale).login, exact: true }).click();
  try {
    await expect(page).toHaveURL(new RegExp(`/${locale}/(account|portal)$`));
  } catch (error) {
    test.info().annotations.push({
      type: 'safe-security-probe',
      description: `login-error-visible=${await page.getByText(customerDictionary(locale).authError, { exact: true }).isVisible()}; login-route=${new URL(page.url()).pathname === `/${locale}/login`}`,
    });
    throw error;
  }
}
export async function logout(page: Page, locale: 'ar' | 'en' = 'ar') {
  await page.goto(`/${locale}/account`);
  await page.getByRole('button', { name: customerDictionary(locale).logout, exact: true }).click();
}
export async function axe(page: Page) {
  await expect(page.getByRole('main')).toHaveCount(1);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
export async function principal(role: string) {
  const client = createClient(
    required('STAGING_TEST_API_URL'),
    required('STAGING_TEST_PUBLIC_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: boundedFetch } },
  );
  const signed = await client.auth.signInWithPassword(identities[role]!);
  expect(signed.error).toBeNull();
  return client;
}
export async function op(
  page: Page,
  action: OperationAction,
  entityId: string,
  payload: unknown = {},
  expected = 200,
) {
  let revision = 0;
  if (action === 'create_trip') {
    const r = await admin.from('jobs').select('revision').eq('id', entityId).single();
    expect(r.error).toBeNull();
    revision = r.data!.revision;
  } else if (!['create_job', 'create_driver', 'create_vehicle'].includes(action)) {
    const r = await admin.from('trips').select('revision').eq('id', entityId).maybeSingle();
    revision = r.data?.revision ?? 0;
  }
  const result = await page.evaluate(
    async (body) => {
      const r = await fetch('/api/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return { status: r.status, data: (await r.json()) as { id?: string; revision?: number } };
    },
    { organizationId: org, entityId, revision, action, payload, mutationId: randomUUID() },
  );
  if (result.status !== expected)
    test.info().annotations.push({
      type: 'safe-security-probe',
      description: JSON.stringify({ action, expected, status: result.status }),
    });
  expect(result.status).toBe(expected);
  return result.data.id!;
}

export async function acceptedOrder(page: Page, country: 'SA' | 'EG') {
  const ct = customerDictionary('ar'),
    qt = quotesDictionary('ar');
  const marketResult = await admin
    .from('markets')
    .select('id,currency,timezone,name_ar,name_en')
    .eq('organization_id', org)
    .eq('country_code', country)
    .single();
  expect(marketResult.error).toBeNull();
  const market = marketResult.data!;
  const cityResult = await admin
    .from('market_cities')
    .select('id')
    .eq('market_id', market.id)
    .eq('code', country === 'SA' ? 'riyadh' : 'cairo')
    .single();
  expect(cityResult.error).toBeNull();
  const cityId = cityResult.data!.id;
  await login(page, 'customer');
  // The runner always creates a fresh customer. Await onboarding hydration before continuing.
  await page.locator('#name').fill('Phase 4 controlled customer');
  await page.locator('#phone').fill(country === 'SA' ? '+966500000001' : '+201000000001');
  await page.getByRole('button', { name: ct.saveProfile, exact: true }).click();
  await page.locator('#request-market').focus();
  await expect(page.locator('#request-market')).toBeFocused();
  await page.locator('#request-market').press('Tab');
  await axe(page);
  await page.locator('#request-market').selectOption(market.id);
  await page.getByRole('button', { name: ct.start, exact: true }).click();
  await expect(page).toHaveURL(/\/request\/[a-f0-9-]+$/);
  const requestId = page.url().split('/').at(-1)!;
  await page.goto('/en/request/' + requestId);
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('main')).toContainText(market.name_en);
  await expect(page.locator('main')).toContainText(market.currency);
  await axe(page);
  await page.goto('/ar/request/' + requestId);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.locator('#service').selectOption({ label: 'نقل الأثاث' });
  await expect(page.locator('.save-status')).toHaveText(ct.saved);
  await page.getByRole('button', { name: ct.next, exact: true }).click();
  for (const kind of ['pickup', 'delivery']) {
    await page.locator(`#${kind}-city`).selectOption(cityId);
    await page.locator(`#${kind}-district`).fill('Controlled district');
    await page.locator(`#${kind}-address`).fill('Harmless ' + kind);
  }
  await expect(page.locator('.save-status')).toHaveText(ct.saved);
  await page.getByRole('button', { name: ct.next, exact: true }).click();
  await page.locator('#description').fill('Phase 4 disposable acceptance');
  await page.getByRole('button', { name: ct.addItem, exact: true }).click();
  await page.locator('#item-0').fill('Box');
  await expect(page.locator('.save-status')).toHaveText(ct.saved);
  await page.getByRole('button', { name: ct.next, exact: true }).click();
  for (const kind of ['pickup', 'delivery']) {
    await page.locator(`#${kind}-floor`).fill('0');
    await page.locator(`#${kind}-elevator`).selectOption('true');
  }
  await expect(page.locator('.save-status')).toHaveText(ct.saved);
  await page.getByRole('button', { name: ct.next, exact: true }).click();
  await page.getByRole('button', { name: ct.next, exact: true }).click();
  await page.locator('#date').fill(marketDate(new Date(Date.now() + 86400000), market.timezone));
  await page.locator('#time-window').selectOption('flexible');
  await expect(page.locator('.save-status')).toHaveText(ct.saved);
  await page.getByRole('button', { name: ct.next, exact: true }).click();
  await page.locator('#contact_name').fill('Controlled recipient');
  await page.locator('#contact_phone').fill(country === 'SA' ? '0500000001' : '01000000001');
  await page.locator('#contact_email').fill('fixture@example.invalid');
  await expect(page.locator('#contact_phone')).toHaveValue(
    country === 'SA' ? '+966500000001' : '+201000000001',
  );
  await expect(page.locator('.save-status')).toHaveText(ct.saved);
  await page.getByRole('button', { name: ct.next, exact: true }).click();
  await page.getByRole('button', { name: ct.submit, exact: true }).click();
  await expect(page).toHaveURL(/account\/requests/);
  await logout(page);
  await login(page, 'sales');
  await page.goto(`/ar/portal/quotes/${requestId}`);
  await page.locator('#distance').fill('18.750');
  await page.locator('#source-note').fill('Controlled verified road distance');
  await page.locator('#vehicle').selectOption({ label: 'شاحنة صغيرة' });
  await page.locator('#workers').fill('2');
  await page.getByRole('button', { name: qt.calculate, exact: true }).click();
  await expect(page.getByRole('heading', { name: qt.calculated, exact: true })).toBeVisible();
  await page.getByRole('button', { name: qt.createDraft, exact: true }).click();
  await page.getByRole('button', { name: qt.sendQuote, exact: true }).click();
  await expect(page.getByRole('button', { name: qt.sendQuote, exact: true })).toBeHidden();
  const version = await admin
    .from('quotes')
    .select('quote_versions(id,status)')
    .eq('request_id', requestId)
    .single();
  expect(version.error).toBeNull();
  const versionId = version.data!.quote_versions.find((v) => v.status === 'SENT')!.id;
  await logout(page);
  await login(page, 'customer');
  await page.goto(`/ar/account/quotes/${versionId}`);
  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: qt.accept, exact: true }).click();
  await expect(page.getByRole('button', { name: qt.accept, exact: true })).toBeHidden();
  const order = await admin
    .from('orders')
    .select('*')
    .eq('accepted_quote_version_id', versionId)
    .single();
  expect(order.error).toBeNull();
  const orderId = order.data!.id;

  return { market, cityId, orderId, requestId, versionId };
}

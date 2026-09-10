import AxeBuilder from '@axe-core/playwright';
import { createClient } from '@supabase/supabase-js';
import type { Page } from '@playwright/test';
import { test, expect } from '../staging/fixtures';
import { customerDictionary } from '../../src/i18n/customer';
import { quotesDictionary } from '../../src/i18n/quotes';
import { dictionary } from '../../src/i18n/dictionaries';

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing guarded ${name}`);
  return value;
};
const customer = {
  email: required('STAGING_PHASE2_CUSTOMER_EMAIL'),
  password: required('STAGING_PHASE2_CUSTOMER_PASSWORD'),
};
const sales = {
  email: required('STAGING_PHASE2_SALES_EMAIL'),
  password: required('STAGING_PHASE2_SALES_PASSWORD'),
};
const peer = {
  email: required('STAGING_PHASE2_PEER_EMAIL'),
  password: required('STAGING_PHASE2_PEER_PASSWORD'),
};
const requestIds = JSON.parse(required('STAGING_PHASE2_REQUEST_IDS')) as string[];
const admin = createClient(required('STAGING_TEST_API_URL'), required('STAGING_TEST_ADMIN_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function login(page: Page, identity: typeof customer, locale: 'ar' | 'en' = 'ar') {
  const t = customerDictionary(locale);
  await page.goto(`/${locale}/login`);
  await page.locator('#email').fill(identity.email);
  await page.locator('#password').fill(identity.password);
  await page.getByRole('button', { name: t.login, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/(account|portal)$`));
}
async function logout(page: Page, locale: 'ar' | 'en' = 'ar') {
  await page.goto(`/${locale}/account`);
  await page.getByRole('button', { name: customerDictionary(locale).logout, exact: true }).click();
}

test('hosted commercial journey enforces pricing, lifecycle, isolation and accessibility', async ({
  page,
  baseURL,
}) => {
  const locale = 'ar',
    ct = customerDictionary(locale),
    qt = quotesDictionary(locale);
  await page.goto(`/${locale}`);
  expect(
    await page.evaluate(
      async () =>
        (
          await fetch('/api/sales/pricing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
          })
        ).status,
    ),
  ).toBe(401);
  await login(page, customer);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  expect(
    await page.evaluate(
      async () =>
        (
          await fetch('/api/sales/pricing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              requestId: crypto.randomUUID(),
              distanceKm: 1,
              vehicleClassId: crypto.randomUUID(),
              workerCount: 1,
              mutationId: crypto.randomUUID(),
            }),
          })
        ).status,
    ),
  ).toBe(403);
  await page.getByRole('button', { name: ct.start, exact: true }).click();
  const primaryRequestId = new URL(page.url()).pathname.split('/').at(-1)!;
  await page.locator('#service').selectOption({ label: 'نقل الأثاث' });
  await expect(page.locator('.save-status')).toHaveText(ct.saved);
  await page.getByRole('button', { name: ct.next, exact: true }).click();
  for (const kind of ['pickup', 'delivery']) {
    await page.locator(`#${kind}-city`).fill('Riyadh');
    await page.locator(`#${kind}-district`).fill('Phase 2 district');
    await page.locator(`#${kind}-address`).fill(`Harmless ${kind}`);
  }
  await expect(page.locator('.save-status')).toHaveText(ct.saved);
  await page.getByRole('button', { name: ct.next, exact: true }).click();
  await page.locator('#description').fill('Phase 2 disposable request');
  await page.getByRole('button', { name: ct.addItem, exact: true }).click();
  await page.locator('#item-0').fill('Box');
  await expect(page.locator('.save-status')).toHaveText(ct.saved);
  await page.getByRole('button', { name: ct.next, exact: true }).click();
  await page.locator('#pickup-floor').fill('2');
  await page.locator('#pickup-elevator').selectOption('false');
  await page.locator('#delivery-floor').fill('1');
  await page.locator('#delivery-elevator').selectOption('true');
  await expect(page.locator('.save-status')).toHaveText(ct.saved);
  await page.getByRole('button', { name: ct.next, exact: true }).click();
  await page.getByRole('checkbox', { name: 'تغليف', exact: true }).check();
  await expect(page.locator('.save-status')).toHaveText(ct.saved);
  await page.getByRole('button', { name: ct.next, exact: true }).click();
  await page.locator('#time-window').selectOption('flexible');
  await expect(page.locator('.save-status')).toHaveText(ct.saved);
  await page.getByRole('button', { name: ct.next, exact: true }).click();
  await expect(page.locator('#contact_name')).not.toHaveValue('');
  await page.getByRole('button', { name: ct.next, exact: true }).click();
  await page.getByRole('button', { name: ct.submit, exact: true }).click();
  await expect(page).toHaveURL(/account\/requests/);
  await logout(page);
  await login(page, sales);
  await page.goto(`/${locale}/portal/quotes`);
  await page.locator(`a[href$="/${primaryRequestId}"]`).click();
  await expect(page.getByRole('heading', { name: /التسعير الأولي/ })).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.locator('#distance').fill('18.750');
  await page.locator('#source-note').fill('Controlled staging route verification');
  await page.locator('#vehicle').selectOption({ label: 'شاحنة صغيرة' });
  await page.locator('#workers').fill('2');
  await page.getByRole('button', { name: qt.calculate, exact: true }).click();
  await expect(page.getByRole('heading', { name: qt.calculated, exact: true })).toBeVisible();
  await page.locator('#adjustment').fill('10.00');
  await page.locator('#adjustment-reason').fill('Controlled hosted acceptance adjustment');
  await page.locator('#validity').fill('48');
  await page.getByRole('button', { name: qt.createDraft, exact: true }).click();
  await expect(page.getByRole('button', { name: qt.sendQuote, exact: true })).toBeVisible();
  await page.getByRole('button', { name: qt.sendQuote, exact: true }).click();
  const primary = await admin
    .from('quotes')
    .select('quote_versions(id,status)')
    .eq('request_id', primaryRequestId)
    .single();
  expect(primary.error).toBeNull();
  const primaryVersion = primary.data!.quote_versions.find((v) => v.status === 'SENT')!.id;
  const commercial = async (requestId: string, distanceKm: number, validitySeconds = 172800) =>
    page.evaluate(
      async ({ requestId, distanceKm, validitySeconds }) => {
        const post = async (url: string, body: unknown) => {
          const r = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          return { status: r.status, data: await r.json() };
        };
        const price = await post('/api/sales/pricing', {
          requestId,
          distanceKm,
          sourceNote: 'Hosted controlled verification',
          vehicleClassId: (document.querySelector('#vehicle') as HTMLSelectElement).value,
          workerCount: 2,
          mutationId: crypto.randomUUID(),
        });
        if (price.status !== 200) throw new Error('pricing failed');
        const draft = await post('/api/sales/quotes', {
          evaluationId: price.data.id,
          adjustmentMinor: 0,
          adjustmentReason: '',
          validitySeconds,
          mutationId: crypto.randomUUID(),
        });
        if (draft.status !== 200) throw new Error('draft failed');
        const sent = await post(`/api/sales/quotes/${draft.data.id}/send`, {});
        if (sent.status !== 200) throw new Error('send failed');
        return draft.data.id as string;
      },
      { requestId, distanceKm, validitySeconds },
    );
  const rejectedVersion = await commercial(requestIds[0]!, 20);
  const expiredVersion = await commercial(requestIds[1]!, 25, 1);
  const supersededV1 = await commercial(requestIds[2]!, 30);
  const supersededV2 = await commercial(requestIds[2]!, 32);
  await logout(page);
  await login(page, customer);
  await page.goto('/en/account/quotes');
  await expect(page.getByRole('heading', { name: quotesDictionary('en').myQuotes })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await page.goto(`/${locale}/account/quotes/${primaryVersion}`);
  await expect(page.getByText(qt.manualVerified, { exact: false })).toBeVisible();
  await expect(page.getByText(qt.vat, { exact: false })).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false,
  );
  await page.setViewportSize({ width: 1280, height: 800 });
  const accepted = await page.evaluate(
    async (id) =>
      Promise.all(
        [1, 2].map(() =>
          fetch(`/api/customer/quotes/${id}/respond`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'accept',
              idempotencyKey: crypto.randomUUID(),
              reason: '',
            }),
          }).then((r) => r.status),
        ),
      ),
    primaryVersion,
  );
  expect(accepted).toEqual([200, 200]);
  await page.reload();
  await expect(page.getByText(qt.orderCreated, { exact: false })).toBeVisible();
  const oneOrder = await admin
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('accepted_quote_version_id', primaryVersion);
  expect(oneOrder.count).toBe(1);
  const rejectStatus = await page.evaluate(
    async (id) =>
      (
        await fetch(`/api/customer/quotes/${id}/respond`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'reject',
            idempotencyKey: crypto.randomUUID(),
            reason: 'Controlled rejection',
          }),
        })
      ).status,
    rejectedVersion,
  );
  expect(rejectStatus).toBe(200);
  expect(
    await page.evaluate(
      async (id) =>
        (
          await fetch(`/api/customer/quotes/${id}/respond`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'accept',
              idempotencyKey: crypto.randomUUID(),
              reason: '',
            }),
          })
        ).status,
      rejectedVersion,
    ),
  ).toBe(400);
  await page.waitForTimeout(1100);
  expect(
    await page.evaluate(
      async (id) =>
        (
          await fetch(`/api/customer/quotes/${id}/respond`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'accept',
              idempotencyKey: crypto.randomUUID(),
              reason: '',
            }),
          })
        ).status,
      expiredVersion,
    ),
  ).toBe(400);
  const expiredState = await admin
    .from('quote_versions')
    .select('status')
    .eq('id', expiredVersion)
    .single();
  expect(expiredState.error).toBeNull();
  expect(expiredState.data?.status).toBe('EXPIRED');
  expect(
    await page.evaluate(
      async (id) =>
        (
          await fetch(`/api/customer/quotes/${id}/respond`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'accept',
              idempotencyKey: crypto.randomUUID(),
              reason: '',
            }),
          })
        ).status,
      supersededV1,
    ),
  ).toBe(400);
  expect(
    await page.evaluate(
      async (id) =>
        (
          await fetch(`/api/customer/quotes/${id}/respond`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'accept',
              idempotencyKey: crypto.randomUUID(),
              reason: '',
            }),
          })
        ).status,
      supersededV2,
    ),
  ).toBe(200);
  const customerClient = createClient(
    required('STAGING_TEST_API_URL'),
    required('STAGING_TEST_PUBLIC_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  expect((await customerClient.auth.signInWithPassword(customer)).error).toBeNull();
  const internal = await customerClient.from('quote_pricing_details').select('*');
  expect(internal.error).toBeNull();
  expect(internal.data).toEqual([]);
  await logout(page);
  await login(page, peer);
  await page.goto(`/${locale}/account/quotes/${primaryVersion}`);
  expect(page.url()).toBe(`${baseURL}/${locale}/account/quotes/${primaryVersion}`);
  await expect(page.getByRole('heading', { name: dictionary(locale).notFound })).toBeVisible();
  const suspended = await admin
    .from('organization_memberships')
    .update({ status: 'suspended' })
    .eq('profile_id', required('STAGING_PHASE2_CUSTOMER_ID'));
  expect(suspended.error).toBeNull();
  try {
    await logout(page);
    await login(page, customer);
    await page.goto(`/${locale}/account/quotes/${primaryVersion}`);
    await expect(page).toHaveURL(`${baseURL}/${locale}/account`);
  } finally {
    expect(
      (
        await admin
          .from('organization_memberships')
          .update({ status: 'active' })
          .eq('profile_id', required('STAGING_PHASE2_CUSTOMER_ID'))
      ).error,
    ).toBeNull();
  }
});

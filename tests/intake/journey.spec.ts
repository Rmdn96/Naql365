import AxeBuilder from '@axe-core/playwright';
import { createClient } from '@supabase/supabase-js';
import { test, expect, testIdentity } from '../staging/fixtures';
import { customerDictionary } from '../../src/i18n/customer';
import { riyadhDate } from '../../src/domain/requests/intake';
test('customer persists a bilingual request through private image, review, submit and history', async ({
  page,
  baseURL,
}, testInfo) => {
  const locale = testInfo.project.name === 'mobile' ? 'en' : 'ar';
  const t = customerDictionary(locale),
    identity = testIdentity();
  await page.goto(`/${locale}/login`);
  await page.locator('#email').fill(identity.email);
  await page.locator('#password').fill(identity.password);
  await page.getByRole('button', { name: t.login, exact: true }).click();
  await expect(page).toHaveURL(`${baseURL}/${locale}/account`);
  await page.locator('#name').fill('Naql365 acceptance fixture');
  await page.locator('#phone').fill('+966500000001');
  await page.getByRole('button', { name: t.saveProfile, exact: true }).click();
  await expect(page.getByRole('button', { name: t.start, exact: true })).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.getByRole('button', { name: t.start, exact: true }).click();
  await expect(page).toHaveURL(/\/request\/[a-f0-9-]+$/);
  const draftUrl = page.url();
  const service = await page.locator('#service option').allTextContents();
  expect(service.length).toBeGreaterThan(1);
  await page
    .locator('#service')
    .selectOption({ label: locale === 'ar' ? 'نقل الأثاث' : 'Furniture moving' });
  await expect(page.locator('.save-status')).toHaveText(t.saved);
  await page.getByRole('button', { name: t.next, exact: true }).click();
  for (const kind of ['pickup', 'delivery']) {
    await page.locator(`#${kind}-city`).fill(kind === 'pickup' ? 'Riyadh' : 'Jeddah');
    await page.locator(`#${kind}-district`).fill('Acceptance district');
    await page.locator(`#${kind}-address`).fill(`Harmless ${kind} address`);
    await page.locator(`#${kind}-notes`).fill('No real business data');
  }
  await expect(page.locator('.save-status')).toHaveText(t.saved);
  await page.reload();
  await page.locator('.wizard-progress button').nth(1).click();
  await expect(page.locator('#pickup-city')).toHaveValue('Riyadh');
  await page.getByRole('button', { name: t.next, exact: true }).click();
  await page.locator('#description').fill('Harmless staging furniture request');
  await page.getByRole('button', { name: t.addItem, exact: true }).click();
  await page.locator('#item-0').fill('Box');
  await page.locator('#quantity-0').fill('2');
  await page.getByRole('button', { name: t.addItem, exact: true }).click();
  await page.locator('#item-1').fill('Desk');
  await expect(page.locator('.save-status')).toHaveText(t.saved);
  await page.locator('#attachment').setInputFiles({
    name: 'fixture.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jQmQAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await expect(page.locator('.wizard-fields')).toBeEnabled();
  await expect(page.locator('.wizard-fields li')).toHaveCount(1);
  await expect(page.locator('.wizard-fields li')).toContainText(t.saved);
  await page.getByRole('button', { name: t.next, exact: true }).click();
  await page.locator('#pickup-floor').fill('2');
  await page.locator('#pickup-elevator').selectOption('true');
  await page.locator('#delivery-floor').fill('1');
  await page.locator('#delivery-elevator').selectOption('false');
  await expect(page.locator('.save-status')).toHaveText(t.saved);
  await page.getByRole('button', { name: t.next, exact: true }).click();
  await page
    .getByRole('checkbox', { name: locale === 'ar' ? 'تغليف' : 'Packing', exact: true })
    .check();
  await expect(page.locator('.save-status')).toHaveText(t.saved);
  await page.getByRole('button', { name: t.next, exact: true }).click();
  await page.locator('#date').fill(riyadhDate(new Date(Date.now() + 86400000)));
  await page.locator('#time-window').selectOption('morning');
  await expect(page.locator('.save-status')).toHaveText(t.saved);
  await page.getByRole('button', { name: t.next, exact: true }).click();
  await expect(page.locator('#contact_name')).toHaveValue('Naql365 acceptance fixture');
  await page.locator('#contact_notes').fill('Acceptance only');
  await expect(page.locator('.save-status')).toHaveText(t.saved);
  await page.getByRole('button', { name: t.next, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t.review);
  await expect(page.locator('.request-summary')).toContainText('Box');
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.tagName !== 'BODY')).toBe(true);
  await page.getByRole('button', { name: t.submit, exact: true }).click();
  await expect(page).toHaveURL(/\/account\/requests\/[a-f0-9-]+$/);
  await expect(page.locator('.request-reference')).toHaveText(/^N365-\d{6}-\d{6,}$/);
  const reference = await page.locator('.request-reference').innerText();
  await page.reload();
  await expect(page.locator('.request-reference')).toHaveText(reference);
  await expect(page.locator('.request-summary')).toContainText(
    'Harmless staging furniture request',
  );
  const requestId = new URL(draftUrl).pathname.split('/').at(-1)!;
  const submitted = await page.evaluate(async (id) => {
    const r = await fetch(`/api/customer/requests/${id}`);
    const d = await r.json();
    return {
      id: d.request.id,
      revision: d.request.revision,
      status: d.request.status,
      payload: d.payload,
    };
  }, requestId);
  const denied = await page.evaluate(
    async (d) =>
      (
        await fetch(`/api/customer/requests/${d.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operation: 'save',
            revision: d.revision,
            mutationId: crypto.randomUUID(),
            payload: d.payload,
          }),
        })
      ).status,
    submitted,
  );
  expect(denied).toBe(400);
  await page.getByRole('link', { name: t.allRequests, exact: true }).click();
  await expect(page.getByRole('link', { name: reference, exact: true })).toBeVisible();
  await page.getByRole('link', { name: reference, exact: true }).click();
  await expect(page.locator('.request-reference')).toHaveText(reference);
  await page.goto(draftUrl);
  await expect(page).toHaveURL(new RegExp(`/account/requests/${requestId}$`));
  await page.goto(`/${locale}/account`);
  await page.getByRole('button', { name: t.logout, exact: true }).click();
  await page.goto(draftUrl);
  await expect(page).toHaveURL(`${baseURL}/${locale}/login`);
});

test('customer direct APIs reject IDOR, mass assignment, stale writes and suspended membership', async ({
  page,
  baseURL,
}, testInfo) => {
  const locale = testInfo.project.name === 'mobile' ? 'en' : 'ar',
    t = customerDictionary(locale),
    identity = testIdentity();
  const url = process.env.STAGING_TEST_API_URL!,
    key = process.env.STAGING_TEST_PUBLIC_KEY!,
    adminKey = process.env.STAGING_TEST_ADMIN_KEY!,
    profile = process.env.STAGING_TEST_PROFILE_ID!,
    org = process.env.STAGING_TEST_ORG_ID!,
    peer = process.env.STAGING_TEST_PEER_REQUEST_ID!,
    other = process.env.STAGING_TEST_OTHER_REQUEST_ID!;
  if (!url || !key || !adminKey || !profile || !org || !peer || !other)
    throw new Error('Guarded acceptance fixture required');
  const admin = createClient(url, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await page.goto(`/${locale}`);
  const anonymous = await page.evaluate(async () => ({
    create: (
      await fetch('/api/customer/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: crypto.randomUUID() }),
      })
    ).status,
  }));
  expect(anonymous.create).toBe(401);
  await page.goto(`/${locale}/login`);
  await page.locator('#email').fill(identity.email);
  await page.locator('#password').fill(identity.password);
  await page.getByRole('button', { name: t.login, exact: true }).click();
  await expect(page).toHaveURL(`${baseURL}/${locale}/account`);
  const isolated = await page.evaluate(
    async ({ peer, other }) => {
      const results = [];
      for (const id of [peer, other])
        results.push((await fetch(`/api/customer/requests/${id}`)).status);
      return results;
    },
    { peer, other },
  );
  expect(isolated).toEqual([404, 404]);
  const created = await page.evaluate(async () => {
    const key = crypto.randomUUID();
    const calls = await Promise.all(
      [1, 2].map(() =>
        fetch('/api/customer/requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key }),
        }).then((r) => r.json()),
      ),
    );
    return { id: calls[0].id, same: calls[0].id === calls[1].id };
  });
  expect(created.same).toBe(true);
  const draft = await page.evaluate(
    async (id) => (await fetch(`/api/customer/requests/${id}`)).json(),
    created.id,
  );
  const results = await page.evaluate(
    async ({ draft, peer }) => {
      const post = (body: unknown) =>
        fetch(`/api/customer/requests/${draft.request.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }).then((r) => r.status);
      const base = {
        operation: 'save',
        revision: draft.request.revision,
        mutationId: crypto.randomUUID(),
        payload: draft.payload,
      };
      return {
        mass: await post({ ...base, payload: { ...draft.payload, customer_id: peer } }),
        first: await post(base),
        stale: await post({ ...base, mutationId: crypto.randomUUID() }),
        incomplete: await post({
          operation: 'submit',
          revision: draft.request.revision + 1,
          mutationId: crypto.randomUUID(),
        }),
      };
    },
    { draft, peer },
  );
  expect(results).toEqual({ mass: 400, first: 200, stale: 409, incomplete: 400 });
  const suspended = await admin
    .from('organization_memberships')
    .update({ status: 'suspended' })
    .eq('organization_id', org)
    .eq('profile_id', profile);
  expect(suspended.error === null).toBe(true);
  try {
    expect(
      await page.evaluate(
        async (id) => (await fetch(`/api/customer/requests/${id}`)).status,
        created.id,
      ),
    ).toBe(403);
    await page.goto(`/${locale}/request/${created.id}`);
    await expect(page.getByText(t.forbidden, { exact: true })).toBeVisible();
  } finally {
    const restored = await admin
      .from('organization_memberships')
      .update({ status: 'active' })
      .eq('organization_id', org)
      .eq('profile_id', profile);
    expect(restored.error === null).toBe(true);
  }
  await page.goto(`/${locale}/account`);
  await page.getByRole('button', { name: t.logout, exact: true }).click();
});

import { createClient } from '@supabase/supabase-js';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, testIdentity } from './fixtures';

test('hosted customer isolation, private file capability and suspended routing', async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(180_000);
  const ref = process.env.STAGING_SUPABASE_PROJECT_REF;
  const profile = process.env.STAGING_TEST_PROFILE_ID;
  const organization = process.env.STAGING_TEST_ORG_ID;
  const file = process.env.STAGING_TEST_FILE_ID;
  const peerFile = process.env.STAGING_TEST_PEER_FILE_ID;
  const key = process.env.STAGING_TEST_PUBLIC_KEY;
  const adminKey = process.env.STAGING_TEST_ADMIN_KEY;
  if (
    ref !== 'zuvyfeflkzlciuaauxba' ||
    !profile ||
    !organization ||
    !file ||
    !peerFile ||
    !key ||
    !adminKey
  )
    throw new Error('Guarded, ephemeral Staging fixtures are required');
  const supabaseOrigin = `https://${ref}.supabase.co`;
  // This client stays in the test process. Only the customer JWT/public key enter the browser.
  const admin = createClient(supabaseOrigin, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const identity = testIdentity();
  await page.goto('/ar/login');
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.locator('#email').fill(identity.email);
  await page.locator('input[name="password"]').fill(identity.password);
  await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
  await expect(page).toHaveURL(`${baseURL}/ar/account`);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('حساب العميل');
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  const chunks = (await context.cookies())
    .filter((cookie) => /^sb-.*-auth-token(?:\.\d+)?$/.test(cookie.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  const encoded = chunks.map((cookie) => cookie.value).join('');
  const session: { access_token: string } = JSON.parse(
    Buffer.from(encoded.replace(/^base64-/, ''), 'base64url').toString('utf8'),
  );
  const isolated = await page.evaluate(
    async ({ url, publicKey, token, owner, org }) => {
      const headers = {
        apikey: publicKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
      const organizations = await fetch(`${url}/rest/v1/organizations?select=id`, { headers }).then(
        (r) => r.json(),
      );
      const customers = await fetch(`${url}/rest/v1/customers?select=profile_id`, { headers }).then(
        (r) => r.json(),
      );
      const promotion = await fetch(
        `${url}/rest/v1/organization_memberships?profile_id=eq.${owner}`,
        { method: 'PATCH', headers, body: JSON.stringify({ member_type: 'staff' }) },
      );
      const audit = await fetch(`${url}/rest/v1/audit_logs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'forged', entity_type: 'roles' }),
      });
      const staff = await fetch(`${url}/rest/v1/rpc/has_permission`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ organization_id: org, permission_code: 'portal.access' }),
      }).then((r) => r.json());
      return {
        organization: organizations.length === 1 && organizations[0].id === org,
        customer: customers.length === 1 && customers[0].profile_id === owner,
        promotionDenied: !promotion.ok,
        auditDenied: !audit.ok,
        staffDenied: staff === false,
      };
    },
    {
      url: supabaseOrigin,
      publicKey: key,
      token: session.access_token,
      owner: profile,
      org: organization,
    },
  );
  expect(Object.values(isolated).every(Boolean)).toBe(true);
  const storage = await page.evaluate(
    async ({ id, peer, url, org, owner }) => {
      const authorized = await fetch(`/api/staging/files/${id}`, { cache: 'no-store' });
      const signedUrl = authorized.url;
      const denied = await fetch(`/api/staging/files/${peer}`, { cache: 'no-store' });
      const publicAccess = await fetch(
        `${url}/storage/v1/object/public/attachments/${org}/${owner}/${id}`,
        { cache: 'no-store' },
      );
      return {
        authorized: authorized.ok,
        signedUrl,
        peerDenied: !denied.ok,
        publicDenied: !publicAccess.ok,
      };
    },
    { id: file, peer: peerFile, url: supabaseOrigin, org: organization, owner: profile },
  );
  expect(storage.authorized && storage.peerDenied && storage.publicDenied).toBe(true);
  expect(new URL(storage.signedUrl).origin === supabaseOrigin).toBe(true);
  try {
    const suspended = await admin
      .from('organization_memberships')
      .update({ status: 'suspended' })
      .eq('organization_id', organization)
      .eq('profile_id', profile);
    expect(!suspended.error).toBe(true);
    await page.goto('/ar/account');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('لا تملك صلاحية الوصول');
    expect((await page.goto('/api/staging/session'))?.status()).toBe(403);
    expect((await page.goto(`/api/staging/files/${file}`))?.ok()).toBe(false);
    await page.goto('/ar');
    const signedUrl = storage.signedUrl;
    await new Promise((resolve) => setTimeout(resolve, 65_000));
    const expired = await page.evaluate(
      async (url) => !(await fetch(url, { cache: 'no-store' })).ok,
      signedUrl,
    );
    expect(expired).toBe(true);
  } finally {
    const restored = await admin
      .from('organization_memberships')
      .update({ status: 'active' })
      .eq('organization_id', organization)
      .eq('profile_id', profile);
    expect(!restored.error).toBe(true);
  }
  await page.goto('/ar/account');
  await page.getByRole('button', { name: 'تسجيل الخروج' }).click();
  await expect(page).toHaveURL(`${baseURL}/ar/login`);
  expect((await page.goto(`/api/staging/files/${file}`))?.ok()).toBe(false);
  await page.goto('/ar/account');
  await expect(page).toHaveURL(`${baseURL}/ar/login`);
});

import { test, expect } from '../staging/fixtures';
import { admin, org, identities, login, op, axe } from './helpers';
import { customerDictionary } from '../../src/i18n/customer';
import { dictionary } from '../../src/i18n/dictionaries';

test('hosted Driver session expiry, route revocation and keyboard login in both locales', async ({
  page,
  context,
}) => {
  await login(page, 'operations');
  const market = await admin
    .from('markets')
    .select('id')
    .eq('organization_id', org)
    .eq('country_code', 'SA')
    .single();
  expect(market.error).toBeNull();
  const resource = await op(page, 'create_driver', org, {
    marketId: market.data!.id,
    type: 'INTERNAL',
    name: 'Session fixture',
  });
  // The session-only runner has fresh identities, separate from execution journey fixtures.
  const identity = identities.sessionDriver!;
  expect(
    (await admin.from('drivers').update({ profile_id: identity.id }).eq('id', resource)).error,
  ).toBeNull();
  const role = await admin.from('roles').select('id').eq('code', 'DRIVER').single();
  expect(role.error).toBeNull();
  for (const locale of ['ar', 'en'] as const) {
    const signIn = async () => {
      await page.goto(`/${locale}/driver/login`);
      await axe(page);
      await page.locator('#driver-email').fill(identity.email);
      await page.locator('#driver-email').focus();
      await page.keyboard.press('Tab');
      await expect(page.locator('#driver-password')).toBeFocused();
      await page.locator('#driver-password').fill(identity.password);
      await page
        .getByRole('button', { name: customerDictionary(locale).login, exact: true })
        .click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/driver$`));
    };
    await signIn();
    const cookies = (await context.cookies()).filter((cookie) =>
      /^sb-.*-auth-token(?:\.\d+)?$/.test(cookie.name),
    );
    expect(cookies.length).toBeGreaterThan(0);
    expect(
      cookies.every((cookie) => cookie.secure && cookie.sameSite === 'Lax' && cookie.path === '/'),
    ).toBe(true);
    // Exercise expired browser session cookies, without exposing their values or forging JWTs.
    await context.addCookies(
      cookies.map((cookie) => ({ ...cookie, expires: Math.floor(Date.now() / 1000) - 60 })),
    );
    await page.goto(`/${locale}/driver`);
    await expect(page).toHaveURL(new RegExp(`/${locale}/driver/login$`));
    await signIn();
    expect(
      (
        await admin
          .from('organization_memberships')
          .update({ status: 'suspended' })
          .eq('organization_id', org)
          .eq('profile_id', identity.id)
      ).error,
    ).toBeNull();
    await page.reload();
    await expect(
      page.getByRole('heading', { name: dictionary(locale).unauthorized, exact: true }),
    ).toBeVisible();
    expect(
      (
        await admin
          .from('organization_memberships')
          .update({ status: 'active' })
          .eq('organization_id', org)
          .eq('profile_id', identity.id)
      ).error,
    ).toBeNull();
    expect(
      (
        await admin
          .from('user_roles')
          .delete()
          .eq('organization_id', org)
          .eq('profile_id', identity.id)
      ).error,
    ).toBeNull();
    await page.goto(`/${locale}/driver`);
    await expect(
      page.getByRole('heading', { name: dictionary(locale).unauthorized, exact: true }),
    ).toBeVisible();
    expect(
      (
        await admin
          .from('user_roles')
          .insert({ organization_id: org, profile_id: identity.id, role_id: role.data!.id })
      ).error,
    ).toBeNull();
    await page.goto(`/${locale}/driver`);
    await axe(page);
    await page.getByRole('button', { name: dictionary(locale).logout, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/driver/login$`));
    await page.goto(`/${locale}/driver`);
    await expect(page).toHaveURL(new RegExp(`/${locale}/driver/login$`));
  }
});

import { createClient } from '@supabase/supabase-js';
import { test, expect } from '../staging/fixtures';
import { customerDictionary } from '../../src/i18n/customer';

test('fresh activated customer gets profile feedback, persists after refresh and enters request flow', async ({
  page,
  baseURL,
}, testInfo) => {
  const fixtures = JSON.parse(process.env.STAGING_ONBOARDING_FIXTURES ?? '{}') as Record<
    string,
    { email: string; password: string; id: string; activation: string }
  >;
  const fixture = fixtures[testInfo.project.name];
  if (!fixture) throw new Error('Isolated fresh onboarding fixture required');
  const locale = testInfo.project.name === 'desktop' ? 'ar' : 'en';
  const t = customerDictionary(locale);
  const admin = createClient(
    process.env.STAGING_TEST_API_URL!,
    process.env.STAGING_TEST_ADMIN_KEY!,
    { auth: { persistSession: false } },
  );
  expect(
    (await admin.auth.admin.getUserById(fixture.id)).data.user?.email_confirmed_at,
  ).toBeFalsy();
  await page.goto(fixture.activation);
  await expect
    .poll(async () =>
      Boolean((await admin.auth.admin.getUserById(fixture.id)).data.user?.email_confirmed_at),
    )
    .toBe(true);
  await page.goto(`/${locale}/login`);
  await page.locator('#email').fill(fixture.email);
  await page.locator('#password').fill(fixture.password);
  await page.getByRole('button', { name: t.login, exact: true }).click();
  await expect(page).toHaveURL(`${baseURL}/${locale}/account`);
  await page.locator('#name').fill('Synthetic activated customer');
  await page.locator('#phone').fill('invalid');
  await page.getByRole('button', { name: t.saveProfile, exact: true }).click();
  await expect(
    page
      .locator('form')
      .filter({ has: page.locator('#name') })
      .getByRole('alert'),
  ).toContainText(t.profileValidation);
  await expect(page.locator('#phone')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#name')).toHaveValue('Synthetic activated customer');
  await expect(page.locator('#phone')).toHaveValue('invalid');
  await page.locator('#phone').fill('+966500000001');
  await page.getByRole('button', { name: t.saveProfile, exact: true }).click();
  await expect(page.getByRole('status')).toContainText(t.profileSaved);
  await expect(page.getByRole('button', { name: t.start, exact: true })).toBeDisabled();
  await expect(page.locator('#request-country-hint')).toHaveText(t.requestCountryHint);
  await page.reload();
  await expect(page.locator('#name')).toHaveValue('Synthetic activated customer');
  await expect(page.locator('#phone')).toHaveValue('+966500000001');
  const profile = await admin
    .from('profiles')
    .select('display_name,phone')
    .eq('id', fixture.id)
    .single();
  expect(profile.error).toBeNull();
  expect(profile.data).toEqual({
    display_name: 'Synthetic activated customer',
    phone: '+966500000001',
  });
  const customers = await admin.from('customers').select('id').eq('profile_id', fixture.id);
  expect(customers.error).toBeNull();
  expect(customers.data).toHaveLength(1);
  await page
    .locator('#request-market')
    .selectOption({ label: locale === 'ar' ? 'السعودية — SAR' : 'Saudi Arabia — SAR' });
  await page.getByRole('button', { name: t.start, exact: true }).click();
  await expect(page).toHaveURL(/\/request\/[a-f0-9-]+$/);
  await expect(page.locator('#service')).toBeVisible();
});

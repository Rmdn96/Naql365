import { test, expect, testIdentity } from '../staging/fixtures';

test('registered session survives public navigation and ends only on explicit logout', async ({
  page,
  context,
  baseURL,
}) => {
  const identity = testIdentity();
  await page.goto('/ar/login');
  await page.locator('#email').fill(identity.email);
  await page.locator('#password').fill(identity.password);
  await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
  await expect(page).toHaveURL(`${baseURL}/ar/account`);
  // Inspect attributes only; never serialize cookie values into evidence or assertions.
  async function cookieMetadata() {
    return (await context.cookies())
      .filter((c) => /^sb-.*-auth-token(?:\.\d+)?$/.test(c.name))
      .map(({ name, path, secure, sameSite }) => ({ name, path, secure, sameSite }));
  }
  const initial = await cookieMetadata();
  expect(initial.length).toBeGreaterThan(0);
  for (const cookie of initial)
    expect(cookie).toMatchObject({ path: '/', secure: true, sameSite: 'Lax' });
  for (const path of ['/ar', '/ar#services', '/ar#how', '/en', '/en#contact']) {
    await page.goto(path);
    await expect(page.locator('header .identity-link')).toHaveAttribute(
      'href',
      /\/(ar|en)\/account$/,
    );
    expect(await cookieMetadata()).toEqual(initial);
    const locale = path.startsWith('/en') ? 'en' : 'ar';
    await page.goto(`/${locale}/auth-complete`);
    await expect(page).toHaveURL(`${baseURL}/${locale}/account`);
  }
  await page.goto('/en');
  for (const country of ['EG', 'SA']) {
    await page.locator('#public-market').selectOption(country);
    await expect(page.locator('#public-market')).toBeEnabled();
    await expect(page.locator('header .identity-link')).toHaveAttribute('href', '/en/account');
    expect(await cookieMetadata()).toEqual(initial);
  }
  await page.goto('/en/login');
  await expect(page).toHaveURL(`${baseURL}/en/account`);
  await page.reload();
  await expect(page.locator('header .identity-link')).toHaveAttribute('href', '/en/account');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(`${baseURL}/en/login`);
  expect(await cookieMetadata()).toHaveLength(0);
  await expect(page.locator('header .identity-link')).toHaveAttribute('href', '/en/login');
  await page.goBack();
  await page.goto('/en/account');
  await expect(page).toHaveURL(`${baseURL}/en/login`);
});

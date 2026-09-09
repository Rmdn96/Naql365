import AxeBuilder from '@axe-core/playwright';
import { test, expect, testIdentity } from './fixtures';

test('real customer login, server session, staff denial and logout', async ({
  page,
  context,
  baseURL,
}) => {
  const identity = testIdentity();
  await page.goto('/en/account');
  await expect(page).toHaveURL(`${baseURL}/en/login`);
  await expect(page.locator('input[name="email"]')).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.locator('input[name="email"]').fill(identity.email);
  await page.locator('input[name="password"]').fill(identity.password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(`${baseURL}/en/account`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Customer account');
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  const cookies = (await context.cookies()).filter((cookie) => cookie.name.startsWith('sb-'));
  expect(cookies.length > 0).toBe(true);
  expect(cookies.every((cookie) => cookie.secure && cookie.sameSite === 'Lax')).toBe(true);
  const session = await page.goto('/api/staging/session');
  expect(session?.status()).toBe(200);
  expect(await session?.json()).toEqual({ status: 'authorized' });
  await page.goto('/en/portal');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Access denied');
  await page.goto('/en/account');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(`${baseURL}/en/login`);
  await page.goto('/en/account');
  await expect(page).toHaveURL(`${baseURL}/en/login`);
  expect((await page.goto('/api/staging/session'))?.status()).toBe(401);
});

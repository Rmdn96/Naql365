import { test, expect } from '@playwright/test';
test('public country switch updates WhatsApp and guest request without a login wall', async ({
  page,
}) => {
  await page.goto('/en');
  const contact = page.locator('.floating-contact');
  await expect(contact).toHaveAttribute('href', /^https:\/\/wa\.me\/966558985250\?/);
  await page.getByLabel('Service country').selectOption('EG');
  await expect(contact).toHaveAttribute('href', /^https:\/\/wa\.me\/201009402374\?/);
  await page.getByRole('link', { name: 'Start your request', exact: true }).first().click();
  await expect(page).toHaveURL(/\/en\/request$/);
  await expect(page.locator('#guest-country')).toHaveValue('EG');
  await expect(page.locator('input[type=password]')).toHaveCount(0);
  expect(await page.locator('body').innerText()).not.toContain('IBAN');
});

test('guest exchange rejects predictable references and clears fragment before any request', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.goto('/en/guest#N365-202609-000001');
  await expect(page).toHaveURL(/\/en\/guest$/);
  await expect(page.locator('main [role=alert]')).toBeVisible();
  expect(requests.some((url) => url.includes('N365-202609-000001'))).toBe(false);
});

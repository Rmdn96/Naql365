import { test, expect } from '@playwright/test';
test('telemetry rejects private properties and unavailable legal copy stays unpublished', async ({
  request,
}) => {
  const invalid = await request.post('/api/public/analytics', {
    headers: { Origin: 'http://127.0.0.1:3000' },
    data: { event: 'homepage_viewed', market: 'SA', context: 'home', token: 'not-a-credential' },
  });
  expect(invalid.status()).toBe(400);
  const crossOrigin = await request.post('/api/public/analytics', {
    headers: { Origin: 'https://invalid.example' },
    data: { event: 'homepage_viewed', market: 'SA', context: 'home' },
  });
  expect(crossOrigin.status()).toBe(403);
  expect((await request.get('/ar/legal/privacy')).status()).toBe(404);
  expect((await request.get('/en/legal/terms')).status()).toBe(404);
});
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

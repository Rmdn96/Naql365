import { expect } from '@playwright/test';

// Runs inside the commerce workspace harness, after it seeds its loopback-only backend.
export async function checkGuestStorefront({ page, origin, capture, product, checks }) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.name));
  for (const locale of ['ar', 'en']) {
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(origin + '/' + locale);
      await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
      await expect(page.locator('.store-product').first()).toBeVisible();
      await capture(page, locale, width, 'light', 'commerce-home');
    }
  }
  await page.goto(origin + '/en?search=NoMatchingProductForThisFixture');
  await expect(page.locator('.store-product')).toHaveCount(0);
  await page.goto(origin + '/en?category=' + encodeURIComponent(product.category));
  await expect(page.locator('.store-product')).toHaveCount(1);
  await page.goto(origin + '/en/store/products/' + product.slug);
  await expect(page.getByRole('button', { name: 'Add to cart', exact: true })).toBeVisible();
  await page.goto(origin + '/en?search=Synthetic');
  await page
    .locator('.store-product')
    .getByRole('button', { name: 'Add to cart', exact: true })
    .click();
  await page.goto(origin + '/en/store/cart');
  const quantity = page.locator('input[type=number]').first();
  await expect(quantity).toHaveValue('1');
  await quantity.fill('2');
  await quantity.blur();
  await page.reload();
  await expect(quantity).toHaveValue('2');
  const form = page.locator('#guest-checkout');
  await form.locator('[name=full_name]').fill('Synthetic Browser Customer');
  await form.locator('[name=phone]').fill('01012345678');
  await form.locator('[name=governorate]').selectOption('CAIRO');
  await form.locator('[name=area]').fill('Synthetic area');
  await form.locator('[name=address]').fill('Synthetic isolated delivery address');
  const payment = form.locator('[name=payment_method]');
  if (await payment.first().evaluate((el) => el.tagName === 'SELECT')) {
    await payment.selectOption('CASH');
  } else {
    await form.locator('[value=CASH]').check();
  }
  const saved = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === '/api/store/guest-order' && r.request().method() === 'POST',
  );
  await form.locator('[type=submit]').click();
  const response = await saved;
  expect(response.status()).toBe(201);
  const receipt = await response.json();
  expect(receipt.reference).toEqual(expect.any(String));
  await expect(page.locator('.guest-order-reference')).toContainText(receipt.reference);
  expect(errors).toEqual([]);
  checks.push('Guest basket survives reload; isolated cash order saved and reference displayed');
  return receipt.reference;
}

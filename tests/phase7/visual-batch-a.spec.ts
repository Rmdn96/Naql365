import { test, expect, holdApplicationScripts } from '../staging/fixtures';
import { login, admin, org, axe } from '../phase4/helpers';
import { customerDictionary } from '../../src/i18n/customer';

import { marketDate } from '../../src/domain/markets/model';
import { stage1Capture } from '../helpers/stage1-evidence';
import { captureState } from '../stage2-states/capture';
test('Batch A owned draft and account matrix', async ({ page }) => {
  const country = 'SA';
  const customerRole = 'customer';
  const ct = customerDictionary('ar');
  const marketResult = await admin
    .from('markets')
    .select('id,currency,timezone,name_ar,name_en')
    .eq('organization_id', org)
    .eq('country_code', country)
    .single();
  expect(marketResult.error).toBeNull();
  const market = marketResult.data!;
  const cityResult = await admin
    .from('market_cities')
    .select('id')
    .eq('market_id', market.id)
    .eq('code', country === 'SA' ? 'riyadh' : 'cairo')
    .single();
  expect(cityResult.error).toBeNull();
  const cityId = cityResult.data!.id;
  await login(page, customerRole);
  // A second Market journey reuses this run's customer; await streamed profile markup.
  await expect(page.locator('#name')).toBeAttached();
  if (await page.locator('.profile-settings:not([open])').count())
    await page.locator('.profile-settings > summary').click();
  await page.locator('#name').fill('Phase 4 controlled customer');
  await page.locator('#phone').fill(country === 'SA' ? '+966500000001' : '+201000000001');
  await page.getByRole('button', { name: ct.saveProfile, exact: true }).click();
  // Profile save navigates/re-renders the account. Wait for its authoritative
  // success state before testing keyboard focus on the replacement form.
  await expect(page.getByRole('status')).toContainText(ct.profileSaved);
  // SSR intentionally disables this control until its client handlers hydrate.
  // locator.focus() does not wait for enabled actionability as click() does.
  await expect(page.locator('#request-market')).toBeEnabled();
  await page.locator('#request-market').focus();
  await expect(page.locator('#request-market')).toBeFocused();
  await page.locator('#request-market').press('Tab');
  await axe(page);
  const customerViewport = page.viewportSize();
  await page.setViewportSize({ width: 1440, height: 900 });
  await stage1Capture(page, `customer-${country.toLowerCase()}-ar`);
  if (customerViewport) await page.setViewportSize(customerViewport);
  await page.locator('#request-market').selectOption(market.id);
  await page.getByRole('button', { name: ct.start, exact: true }).click();
  await expect(page).toHaveURL(/\/request\/[a-f0-9-]+$/);
  const requestId = page.url().split('/').at(-1)!;
  await page.goto('/en/request/' + requestId, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('main')).toContainText(market.name_en);
  await expect(page.locator('main')).toContainText(market.currency);
  await expect(page.locator('#service')).toBeEnabled();
  await stage1Capture(page, `request-${country.toLowerCase()}-en-mobile`);
  await axe(page);
  await page.goto('/ar/request/' + requestId, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  for (const locale of ['ar', 'en'] as const) {
    await page.goto('/' + locale + '/request/' + requestId);
    await expect(page.locator('#service')).toBeEnabled();
    await page.getByRole('button', { name: customerDictionary(locale).next, exact: true }).click();
    await expect(page.locator('.validation-summary, [role=alert]').first()).toBeVisible();
    await captureState(page, 'request-validation', locale, 'run-ledger:customer-draft');
  }
  await page.goto('/ar/request/' + requestId);
  await page.locator('#service').selectOption({ label: 'نقل الأثاث' });
  await expect(page.locator('.save-status')).toHaveText(ct.saved);
  await page.getByRole('button', { name: ct.next, exact: true }).click();
  for (const kind of ['pickup', 'delivery']) {
    await page.locator(`#${kind}-city`).selectOption(cityId);
    await page.locator(`#${kind}-district`).fill('Controlled district');
    await page.locator(`#${kind}-address`).fill('Harmless ' + kind);
  }
  await expect(page.locator('.save-status')).toHaveText(ct.saved);
  await page.getByRole('button', { name: ct.next, exact: true }).click();
  await page.locator('#description').fill('Phase 4 disposable acceptance');
  await page.getByRole('button', { name: ct.addItem, exact: true }).click();
  await page.locator('#item-0').fill('Box');
  await expect(page.locator('.save-status')).toHaveText(ct.saved);
  await page.getByRole('button', { name: ct.next, exact: true }).click();
  for (const kind of ['pickup', 'delivery']) {
    await page.locator(`#${kind}-floor`).fill('0');
    await page.locator(`#${kind}-elevator`).selectOption('true');
  }
  await expect(page.locator('.save-status')).toHaveText(ct.saved);
  await page.getByRole('button', { name: ct.next, exact: true }).click();
  await page.getByRole('button', { name: ct.next, exact: true }).click();
  await page.locator('#date').fill(marketDate(new Date(Date.now() + 86400000), market.timezone));
  await page.locator('#time-window').selectOption('flexible');
  await expect(page.locator('.save-status')).toHaveText(ct.saved);
  await page.getByRole('button', { name: ct.next, exact: true }).click();
  await page.locator('#contact_name').fill('Controlled recipient');
  await page.locator('#contact_phone').fill(country === 'SA' ? '0500000001' : '01000000001');
  await page.locator('#contact_email').fill('fixture@example.invalid');
  await expect(page.locator('#contact_phone')).toHaveValue(
    country === 'SA' ? '+966500000001' : '+201000000001',
  );
  await expect(page.locator('.save-status')).toHaveText(ct.saved);
  await page.getByRole('button', { name: ct.next, exact: true }).click();

  for (const locale of ['ar', 'en'] as const) {
    await page.goto('/' + locale + '/request/' + requestId);
    await expect(page.locator('#service')).toBeEnabled();
    await page.locator('.wizard-progress button').nth(7).click();
    await expect(
      page.getByRole('button', { name: customerDictionary(locale).submit, exact: true }),
    ).toBeVisible();
    await captureState(page, 'request-review', locale, 'run-ledger:customer-draft');
    await page.goto('/' + locale + '/account');
    await captureState(page, 'account-success', locale, 'run-ledger:customer-draft');
  }
  for (const locale of ['ar', 'en'] as const)
    for (const state of ['account-loading', 'request-loading'] as const) {
      await page.waitForLoadState('load');
      const release = holdApplicationScripts(page);
      try {
        await page.goto(
          '/' + locale + (state === 'account-loading' ? '/account' : '/request/' + requestId),
          { waitUntil: 'commit' },
        );
        await expect(page.locator('.skeleton').first()).toBeVisible();
        await captureState(
          page,
          state,
          locale,
          'run-ledger:customer-draft; delayed application scripts',
        );
      } finally {
        release();
      }
    }
});

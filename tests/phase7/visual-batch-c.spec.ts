import {
  test,
  expect,
  configureProtectedContext,
  holdApplicationScripts,
} from '../staging/fixtures';
import { guestQuote, acceptGuest, executeDelivery } from './helpers';
import { identities } from '../phase4/helpers';
import { captureBoth, captureState } from '../stage2-states/capture';
import { paymentDictionary } from '../../src/i18n/payments';
import { customerDictionary } from '../../src/i18n/customer';
import { randomUUID } from 'node:crypto';

test('Batch C owned tracking lifecycle matrix', async ({ page, browser, baseURL }) => {
  if (!baseURL) throw Error('Verified Preview required');
  const context = await browser.newContext({ baseURL });
  await configureProtectedContext(context, baseURL);
  try {
    const staff = await context.newPage();
    const journey = await guestQuote(page, staff, 'SA');
    const order = await acceptGuest(page, journey.versionId, 'ar');
    const t = paymentDictionary('ar');
    await page.getByRole('button', { name: t.cash, exact: true }).click();
    await expect(page.getByText(t.states.CASH_DUE, { exact: true })).toBeVisible();
    const path = `/ar/guest/orders/${order}`;
    await page.goto(path);
    await captureBoth(page, 'tracking-active', 'run-ledger:SA-active-order-before-dispatch');
    for (const locale of ['ar', 'en'] as const) {
      await page.waitForLoadState('load');
      const release = holdApplicationScripts(page);
      try {
        await page.goto(path.replace('/ar/', `/${locale}/`), { waitUntil: 'commit' });
        await expect(page.locator('.skeleton').first()).toBeVisible();
        await captureState(
          page,
          'tracking-loading',
          locale,
          'run-ledger:SA-order; delayed scripts',
        );
      } finally {
        release();
      }
    }
    await executeDelivery(staff, order, 'SA', journey.market.id, journey.cityId);
    await page.goto(path);
    await captureBoth(page, 'tracking-completed', 'run-ledger:SA-completed-order');
    await page.goto(`/ar/guest/orders/${randomUUID()}`);
    await captureBoth(page, 'tracking-empty-error', 'random-unowned-order; safe not-found');
  } finally {
    await context.close();
  }
});

test('Batch C registration nondisclosing email-sent presentation', async ({ page }) => {
  // Existing run-owned synthetic identity yields the genuine nondisclosing sent state.
  // This captures UI only, not a new delivered-mail claim; the owner mailbox gate is closed.
  for (const locale of ['ar', 'en'] as const) {
    await page.goto(`/${locale}/register`);
    await page.locator('#email').fill(identities.customer!.email);
    await page.locator('#password').fill(identities.customer!.password);
    await page
      .getByRole('button', { name: customerDictionary(locale).register, exact: true })
      .click();
    await expect(page.getByRole('status')).toContainText(customerDictionary(locale).sent);
    await page.locator('#email').fill('');
    await page.locator('#password').fill('');
    await captureState(
      page,
      'signup-email-sent',
      locale,
      'run-ledger:customer; existing-account nondisclosure; no delivered-mail claim',
    );
  }
});

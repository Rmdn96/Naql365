import { test, expect } from '../staging/fixtures';
import { login } from '../phase4/helpers';
import { customerDictionary } from '../../src/i18n/customer';
import { captureState } from '../stage2-states/capture';

test('owned synthetic customer identity visual states only', async ({ page }) => {
  await login(page, 'customer', 'en');
  for (const locale of ['ar', 'en'] as const) {
    await page.goto(`/${locale}/account`);
    await expect(page.locator('#name')).toBeVisible();
    await captureState(page, 'profile-incomplete', locale, 'run-ledger:customer');
    // Confirmation success has no separate success page: its implemented landing is onboarding.
    // This captures that destination only; the accepted real-mailbox test proves the transition.
    await captureState(
      page,
      'confirmation-success',
      locale,
      'run-ledger:customer; onboarding destination only',
    );
    await page.locator('#name').fill('VISUAL TEST CUSTOMER');
    await page.locator('#phone').fill('invalid');
    await page
      .getByRole('button', { name: customerDictionary(locale).saveProfile, exact: true })
      .click();
    await expect(page.locator('main [role=alert]')).toBeVisible();
    await captureState(page, 'profile-validation', locale, 'run-ledger:customer');
  }
  for (const locale of ['ar', 'en'] as const) {
    await page.goto('/' + locale + '/account');
    if (await page.locator('.profile-settings:not([open])').count())
      await page.locator('.profile-settings > summary').click();
    await page.locator('#name').fill('VISUAL TEST CUSTOMER');
    await page.locator('#phone').fill('+966500000001');
    await page
      .getByRole('button', { name: customerDictionary(locale).saveProfile, exact: true })
      .click();
    await expect(page.getByRole('status')).toContainText(customerDictionary(locale).profileSaved);
    await captureState(page, 'profile-success', locale, 'run-ledger:customer');
    await page.goto(`/${locale}/account`);
    await captureState(page, 'account-empty', locale, 'run-ledger:customer');
    await page.goto(`/${locale}/password`);
    await expect(page.locator('#password')).toBeVisible();
    await captureState(
      page,
      'recovery-valid',
      locale,
      'run-ledger:customer; authenticated password form, no password mutation',
    );
    // Subsequent locale uses the existing profile editor, without changing membership.
    if (locale === 'ar') {
      await page.goto('/en/account');
      await page.locator('.profile-settings > summary').click();
    }
  }
});

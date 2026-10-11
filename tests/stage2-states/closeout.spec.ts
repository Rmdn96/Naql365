import { test, expect } from '../staging/fixtures';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { applicationSha, locales, widths } from './matrix';
import { authErrorMessage } from '../../src/i18n/auth-errors';

// These cases use no existing identity and create no Auth/business/Storage records.
// Reserved .invalid addresses are never evidence of delivered email.
const publicStates = [
  'signup-initial',
  'signup-validation',
  'confirmation-invalid',
  'login-initial',
  'login-error',
  'recovery-request',
  'recovery-email-sent',
  'recovery-invalid',
] as const;
for (const locale of locales)
  for (const state of publicStates) {
    test(`${locale} ${state}`, async ({ page }) => {
      const directory = process.env.STAGING_STATE_SCREENSHOTS;
      if (!directory) throw Error('Evidence directory required');
      mkdirSync(directory, { recursive: true });
      const route = state.startsWith('signup')
        ? 'register'
        : state === 'recovery-request' || state === 'recovery-email-sent'
          ? 'recover'
          : 'login';
      if (state === 'confirmation-invalid' || state === 'recovery-invalid') {
        await page.goto(
          `/auth/callback?locale=${locale}${state === 'recovery-invalid' ? `&next=/${locale}/password` : ''}`,
        );
        await expect(page.locator('main [role=alert]')).toContainText(
          authErrorMessage(locale, 'confirmationLink'),
        );
      } else await page.goto(`/${locale}/${route}`);
      await expect(page.locator('main h1')).toBeVisible();
      const submit = page
        .locator('main form button[type=submit], main form button:not([type])')
        .first();
      if (state === 'signup-validation') {
        await submit.click();
        expect(
          await page.locator('#email').evaluate((e: HTMLInputElement) => e.validity.valueMissing),
        ).toBe(true);
      }
      if (state === 'login-error' || state === 'recovery-email-sent') {
        await page.locator('#email').fill(`stage2-visual-${randomUUID()}@example.invalid`);
        if (state === 'login-error') await page.locator('#password').fill(randomUUID());
        await submit.click();
        await expect(
          page.locator(state === 'login-error' ? 'main [role=alert]' : 'main .alert[role=status]'),
        ).toBeVisible();
        if (state === 'login-error')
          await expect(page.locator('main [role=alert]')).toContainText(
            authErrorMessage(locale, 'credentials'),
          );
        await page.locator('#email').fill('');
        if (state === 'login-error') await page.locator('#password').fill('');
      }
      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 });
        await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        for (const input of await page.locator('input:not([type=hidden])').all())
          await expect(input).toHaveValue('');
        const violations = (
          await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
        ).violations;
        expect(violations).toEqual([]);
        const keyboardTarget = page.locator('main input:not([type=hidden]):visible').first();
        await keyboardTarget.focus();
        await expect(keyboardTarget).toBeFocused();
        const file = `${locale}-${width}-${state}.png`;
        const bytes = await page.screenshot({
          path: join(directory, file),
          fullPage: true,
          timeout: 30000,
        });
        writeFileSync(
          join(directory, `${locale}-${width}-${state}.json`),
          JSON.stringify(
            {
              state,
              locale,
              viewport: { width, height: 900 },
              applicationSha,
              capturedAt: new Date().toISOString(),
              result: 'PASS',
              filename: file,
              sha256: createHash('sha256').update(bytes).digest('hex'),
              fixtureReference: null,
              overflow: false,
              axeViolations: 0,
              keyboardFocus: true,
              scope:
                'Automated geometry/axe/focus and capture checks; manual visual inspection separately required',
            },
            null,
            2,
          ),
        );
      }
    });
  }

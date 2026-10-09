import { test, expect } from '../staging/fixtures';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const widths = [360, 390, 768, 1280, 1440];
for (const locale of ['ar', 'en'] as const) {
  test(`${locale} public identity state matrix on exact hosted application`, async ({ page }) => {
    const directory = process.env.STAGING_STATE_SCREENSHOTS;
    if (!directory) throw Error('Explicit safe evidence directory required');
    mkdirSync(directory, { recursive: true });
    const evidence: object[] = [];
    for (const state of [
      'signup-initial',
      'login-initial',
      'recovery-request',
      'native-validation',
      'invalid-confirmation',
    ] as const) {
      const path =
        state === 'signup-initial'
          ? 'register'
          : state === 'recovery-request'
            ? 'recover'
            : 'login';
      if (state === 'invalid-confirmation') await page.goto(`/auth/callback?locale=${locale}`);
      else await page.goto(`/${locale}/${path}`);
      await expect(page.locator('main h1')).toBeVisible();
      if (state === 'invalid-confirmation')
        await expect(page.locator('main [role=alert]')).toBeVisible();
      // No real email, password, confirmation code or business mutation is used here.
      if (state === 'native-validation') {
        await page
          .locator('main form button[type=submit], main form button:not([type])')
          .first()
          .click();
        expect(
          await page.locator('#email').evaluate((e: HTMLInputElement) => e.validity.valueMissing),
        ).toBe(true);
      }
      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 });
        await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        for (const input of await page.locator('main input:not([type=hidden])').all())
          await expect(input).toHaveValue('');
        const violations = (
          await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
        ).violations;
        expect(violations).toEqual([]);
        const file = `${locale}-${state}-${width}.png`;
        await page.screenshot({ path: join(directory, file), fullPage: true });
        evidence.push({
          locale,
          state,
          width,
          file,
          sha256: createHash('sha256')
            .update(readFileSync(join(directory, file)))
            .digest('hex'),
          overflow: false,
          axeViolations: violations.length,
          confirmationFailureExplained:
            state === 'invalid-confirmation'
              ? (await page.locator('main [role=alert]').count()) > 0
              : null,
        });
      }
    }
    writeFileSync(join(directory, `${locale}-index.json`), JSON.stringify(evidence, null, 2));
  });
}

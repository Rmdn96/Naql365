import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { requiredDriverMatrix, type DriverVisualState } from './driver-v2-matrix';
import { driverDictionary } from '../../src/i18n/driver';
import { driverLoadingMarkup } from './driver-v2-loading.mjs';
import { dictionary } from '../../src/i18n/dictionaries';
import { trackingDictionary } from '../../src/i18n/tracking';
const foregroundSamples = new WeakMap<Page, number>();

// Test-only capture. No application import and no credentials, session storage or network bodies recorded.
export async function driverVisual(page: Page, state: DriverVisualState, market: 'SA' | 'EG') {
  const directory = process.env.STAGING_WAVE5_CAPTURE_DIR;
  if (!directory) return;
  if (directory !== 'docs/reports/evidence/lovable-wave5-driver-final')
    throw Error('DRIVER_EVIDENCE_PATH_DENIED');
  const applicationSha = process.env.ACCEPTANCE_APPLICATION_SHA;
  if (!/^[a-f0-9]{40}$/.test(applicationSha ?? '')) throw Error('EXACT_APPLICATION_SHA_REQUIRED');
  const origin = new URL(page.url()).origin;
  if (origin !== 'https://naql365-staging-ui-v2-naql365.vercel.app')
    throw Error('CANONICAL_ORIGIN_REQUIRED');
  const original = new URL(page.url()),
    viewport = page.viewportSize();
  const required = requiredDriverMatrix();
  mkdirSync(directory, { recursive: true });
  const file = join(directory, 'index.json');
  const index = existsSync(file)
    ? JSON.parse(readFileSync(file, 'utf8'))
    : { applicationSha, rows: [], failures: [] };
  if (index.applicationSha !== applicationSha) throw Error('EVIDENCE_APPLICATION_MISMATCH');
  for (const row of index.rows) {
    if (
      createHash('sha256')
        .update(readFileSync(join(directory, row.filename)))
        .digest('hex') !== row.sha256
    )
      throw Error('PRIOR_EVIDENCE_HASH_INVALID');
  }
  const themeBefore = (await page.locator('html').getAttribute('data-theme')) ?? 'system';
  const save = () => {
    index.required = required;
    index.total = required.length;
    index.pass = index.rows.length;
    index.missing = required
      .filter((r) => !index.rows.some((row: { id: string }) => row.id === r.id))
      .map((r) => r.id);
    writeFileSync(file + '.tmp', JSON.stringify(index, null, 2) + '\n');
    renameSync(file + '.tmp', file);
  };
  try {
    for (const row of required.filter((r) => r.state === state && r.market === market)) {
      if (index.rows.some((old: { id: string }) => old.id === row.id)) continue;
      await page
        .context()
        .addCookies([
          { name: 'naql365_theme', value: row.theme, url: origin, secure: true, sameSite: 'Lax' },
        ]);
      await page.emulateMedia({
        colorScheme: row.system as 'light' | 'dark',
        reducedMotion: 'reduce',
      });
      await page.setViewportSize({ width: row.width, height: 900 });
      const path = original.pathname.replace(/^\/(ar|en)/, '/' + row.locale) + original.search;
      const foreground = state === 'foreground-active' || state === 'foreground-offline';
      if (foreground) {
        const sample = (foregroundSamples.get(page) ?? 0) + 1;
        foregroundSamples.set(page, sample);
        await page.context().setGeolocation({
          latitude: (market === 'SA' ? 24.7136 : 30.0444) + sample * 0.001,
          longitude: market === 'SA' ? 46.6753 : 31.2357,
          accuracy: 5,
        });
      }
      if (!foreground || new URL(page.url()).pathname + new URL(page.url()).search !== path)
        await page.goto(path);
      if (foreground) {
        // Resize/theme changes do not need a navigation, which resets the publisher's
        // display while its existing rate policy legitimately defers a stationary fix.
        await page.setViewportSize({ width: 1440, height: 900 });
        await page
          .getByLabel(row.locale === 'ar' ? 'المظهر' : 'Theme', { exact: true })
          .filter({ visible: true })
          .selectOption(row.theme);
        await page.setViewportSize({ width: row.width, height: 900 });
      }
      if (state === 'loading') {
        await expect(page.locator('.driver-shell')).toBeVisible();
        await expect(page.locator('#public-market')).toBeEnabled();
        // The existing root Loading boundary uses this exact component. Fast SSR may
        // omit its fallback, so render it deterministically in this test DOM only.
        const html = driverLoadingMarkup(dictionary(row.locale).loading);
        await page.locator('main').evaluate((main, markup) => {
          main.innerHTML = markup;
        }, html);
      }
      if (state === 'loading') await expect(page.locator('.skeleton').first()).toBeVisible();
      else await expect(page.locator('.driver-shell')).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute(
        'dir',
        row.locale === 'ar' ? 'rtl' : 'ltr',
      );
      await expect(page.locator('html')).toHaveAttribute('data-theme', row.theme);
      if (state === 'pod-reserved-pending')
        await expect(
          page.getByText(driverDictionary(row.locale).podPending, { exact: true }),
        ).toBeVisible();
      if (state === 'foreground-active' || state === 'foreground-offline') {
        const cadence = await page.evaluate(async () => {
          const trip = location.pathname.split('/').at(-1);
          const response = await fetch('/api/tracking?mode=driver&tripId=' + trip);
          const body = await response.json();
          return { status: response.status, movingSeconds: body.policy?.movingSeconds };
        });
        expect(cadence.status).toBe(200);
        expect(
          Number.isInteger(cadence.movingSeconds) &&
            cadence.movingSeconds >= 10 &&
            cadence.movingSeconds <= 120,
        ).toBe(true);
        await expect(
          page.getByText(trackingDictionary(row.locale).ACTIVE, { exact: true }),
        ).toBeVisible({ timeout: cadence.movingSeconds * 1000 + 20000 });
        if (state === 'foreground-offline') {
          await page.context().setOffline(true);
          await expect(
            page.getByText(trackingDictionary(row.locale).OFFLINE, { exact: true }),
          ).toBeVisible();
        }
      }
      if (state.startsWith('issue-') && state !== 'issue-open') {
        await page.locator('.driver-issue-form > summary').click();
        await expect(page.locator('#issue-reason')).toBeEnabled();
        if (state === 'issue-validation') {
          await page
            .getByRole('button', { name: driverDictionary(row.locale).sendIssue, exact: true })
            .click();
          expect(
            await page
              .locator('#issue-reason')
              .evaluate((e: HTMLInputElement) => e.validity.valueMissing),
          ).toBe(true);
        }
      }
      if (state === 'pod-validation') {
        await expect(page.locator('#pod-recipient')).toBeEnabled();
        await page
          .getByRole('button', { name: driverDictionary(row.locale).submitPod, exact: true })
          .click();
        expect(
          await page
            .locator('#pod-recipient')
            .evaluate((e: HTMLInputElement) => e.validity.valueMissing),
        ).toBe(true);
      }
      if (state === 'command-error') {
        // A failed response, not simulated success; the request is never sent to the backend.
        const endpoint = origin + '/api/driver';
        await page.route(endpoint, (route) =>
          route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: '{"error":"unavailable"}',
          }),
        );
        try {
          await page.locator('.driver-command > .button--primary').click();
          await expect(page.locator('.driver-command [role="alert"]')).toBeVisible();
        } finally {
          await page.unroute(endpoint);
        }
      }
      if (state === 'offline-unconfirmed') {
        await page.context().setOffline(true);
        await page.locator('.driver-command > .button--primary').click();
        await expect(page.locator('.driver-command [role="alert"]')).toBeVisible();
      }
      let releasePending: (() => void) | undefined;
      let pendingHandled: Promise<void> | undefined;
      let pendingEndpoint: string | undefined;
      if (state === 'command-busy-disabled' || state === 'pod-upload-pending') {
        pendingEndpoint =
          origin +
          (state === 'pod-upload-pending' ? '/api/driver/evidence?kind=pod' : '/api/driver');
        const gate = new Promise<void>((resolve) => {
          releasePending = resolve;
        });
        await page.route(pendingEndpoint, async (route) => {
          pendingHandled = (async () => {
            await gate;
            await route.fulfill({
              status: 503,
              contentType: 'application/json',
              body: '{"error":"unavailable"}',
            });
          })();
          await pendingHandled;
        });
        if (state === 'pod-upload-pending') {
          await page.locator('#pod-recipient').fill('TEST ONLY');
          await page.locator('#pod-file').setInputFiles({
            name: 'test.png',
            mimeType: 'image/png',
            buffer: Buffer.from(
              'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS9sAAAAASUVORK5CYII=',
              'base64',
            ),
          });
          await page.locator('.driver-pod .driver-form > .button--primary').click();
        } else await page.locator('.driver-command > .button--primary').click();
        await expect(
          page.locator('[aria-busy="true"]').filter({ visible: true }).last(),
        ).toBeVisible();
        await expect(
          page.locator(
            state === 'pod-upload-pending'
              ? '.driver-pod .driver-form > .button--primary'
              : '.driver-command > .button--primary',
          ),
        ).toBeDisabled();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (state !== 'loading') {
        const action = page
          .locator('.driver-shell :is(a,button,input,select,summary):visible')
          .first();
        await action.focus();
        // Establish keyboard modality after pointer-driven state preparation.
        await page.keyboard.press('Tab');
        await page.keyboard.press('Shift+Tab');
        await expect(action).toBeFocused();
        expect(await action.evaluate((e) => getComputedStyle(e).outlineStyle)).not.toBe('none');
        const primary = page
          .locator('.driver-shell :is(button.button--primary:enabled, a.button):visible')
          .first();
        if (await primary.count()) {
          for (
            let tab = 0;
            tab < 40 && !(await primary.evaluate((e) => e === document.activeElement));
            tab++
          )
            await page.keyboard.press('Tab');
          await expect(primary).toBeFocused();
        }
      }
      const controls = await page
        .locator('.driver-shell :is(button,a,input,select,canvas):visible')
        .evaluateAll((nodes) =>
          nodes.every((n) => {
            const b = n.getBoundingClientRect();
            return b.left >= -1 && b.right <= innerWidth + 1;
          }),
        );
      expect(controls).toBe(true);
      expect(await page.locator('input[type=password]').count()).toBe(0);
      const visible = await page
        .locator(state === 'loading' ? 'main' : '.driver-shell')
        .innerText();
      expect(visible).not.toMatch(
        /sb_secret_|access_token|refresh_token|Bearer |https?:\/\/.*storage\/v1|Display slot/,
      );
      if (row.width === 360 || row.width === 1440) {
        const result = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        expect(result.violations).toEqual([]);
      }
      const filename = row.id + '.png';
      const skipLink = page.locator('.skip-link');
      if (await skipLink.count())
        expect(
          await skipLink.evaluate(
            (e) => e.matches(':focus') || e.getBoundingClientRect().bottom <= 0,
          ),
        ).toBe(true);
      if (state === 'issue-validation' || state === 'pod-validation') {
        const invalid = page.locator(
          state === 'issue-validation' ? '#issue-reason' : '#pod-recipient',
        );
        await invalid.focus();
        expect(await invalid.evaluate((field: HTMLInputElement) => field.reportValidity())).toBe(
          false,
        );
        await expect(invalid).toBeFocused();
      }
      await page.locator('main').screenshot({
        path: join(directory, filename),
        animations: 'disabled',
        // A full-element capture can include fixed content outside the viewport.
        // Exclude only the unfocused offscreen utility; never hide Driver controls.
        style: '.skip-link:not(:focus) { visibility: hidden !important; }',
      });
      index.rows.push({
        ...row,
        applicationSha,
        result: 'PASS',
        filename,
        sha256: createHash('sha256')
          .update(readFileSync(join(directory, filename)))
          .digest('hex'),
        timestamp: new Date().toISOString(),
        route: path.replace(/\/trips\/[^/?]+/, '/trips/[owned]'),
        evidenceMode: [
          'command-error',
          'command-busy-disabled',
          'offline-unconfirmed',
          'pod-upload-pending',
          'loading',
          'foreground-offline',
        ].includes(state)
          ? 'controlled presentation using real component/response; no successful command simulated'
          : 'real run-owned hosted state',
        fixture: market + '-forward-only-driver-journey',
        runReference: process.env.STAGING_WAVE5_RUN_DIR?.split('/').at(-1) ?? 'owned-driver-run',
        captureNormalization: 'Screenshot-only exclusion of the off-viewport unfocused skip link',
      });
      save();
      if (releasePending) {
        releasePending();
        await pendingHandled;
        await page.unroute(pendingEndpoint!);
      }
      if (state === 'offline-unconfirmed' || state === 'foreground-offline')
        await page.context().setOffline(false);
    }
  } catch (error) {
    index.failures.push({
      state,
      market,
      timestamp: new Date().toISOString(),
      classification: 'VISUAL_ASSERTION_OR_RUNTIME',
    });
    save();
    throw error;
  } finally {
    await page.context().setOffline(false);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await page
      .context()
      .addCookies([
        { name: 'naql365_theme', value: themeBefore, url: origin, secure: true, sameSite: 'Lax' },
      ]);
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
    if (viewport) await page.setViewportSize(viewport);
    await page.goto(original.pathname + original.search);
  }
}

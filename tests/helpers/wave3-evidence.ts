import type { Page, Route } from '@playwright/test';
import { expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { protectionHeaders } from '../../scripts/staging/target.mjs';

/** Real SSR fallback, held by suppressing streamed replacement scripts in this test response only. */
export async function wave3LoadingCapture(page: Page, state: string, locale: 'ar' | 'en') {
  const directory = process.env.STAGING_WAVE3_CAPTURE_DIR;
  if (!directory) return;
  const applicationSha = process.env.ACCEPTANCE_APPLICATION_SHA;
  if (!/^[a-f0-9]{40}$/.test(applicationSha ?? '') || !/^[a-z0-9-]+$/.test(state))
    throw Error('WAVE3_CAPTURE_IDENTITY_REQUIRED');
  const indexPath = join(directory, 'index.json');
  const rows = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf8')).matrix : [];
  const viewport = page.viewportSize();
  const url = `${new URL(page.url()).origin}/${locale}/account`;
  const hold = async (route: Route) => {
    const response = await route.fetch({
      maxRedirects: 0,
      headers: { ...route.request().headers(), ...protectionHeaders() },
    });
    if (response.status() !== 200) throw Error('WAVE3_LOADING_RESPONSE_FAILED');
    const html = await response.text();
    if (!html.includes('skeleton')) throw Error('WAVE3_REAL_FALLBACK_MISSING');
    await route.fulfill({
      response,
      body: html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ''),
    });
  };
  await page.route(url, hold);
  try {
    await page.goto(url);
    const theme = await page.locator('html').getAttribute('data-theme');
    for (const width of [360, 390, 768, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.locator('.skeleton').first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const violations = (
        await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
      ).violations;
      expect(violations).toEqual([]);
      const filename = `${state}-${locale}-${theme}-${width}.png`;
      const existing = rows.find((r: { filename: string }) => r.filename === filename);
      if (existing) {
        if (
          existing.applicationSha !== applicationSha ||
          createHash('sha256')
            .update(readFileSync(join(directory, filename)))
            .digest('hex') !== existing.sha256
        )
          throw Error('WAVE3_EXISTING_EVIDENCE_INVALID');
        continue;
      }
      const bytes = await page.screenshot({ path: join(directory, filename), fullPage: true });
      rows.push({
        state,
        locale,
        theme,
        width,
        applicationSha,
        source:
          'controlled real SSR fallback; streamed replacement scripts suppressed in test response',
        result: 'PASS',
        overflow: false,
        axeViolations: 0,
        filename,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        capturedAt: new Date().toISOString(),
      });
      writeFileSync(indexPath + '.tmp', JSON.stringify({ applicationSha, matrix: rows }, null, 2));
      renameSync(indexPath + '.tmp', indexPath);
    }
  } finally {
    await page.unroute(url, hold);
    await page.reload();
  }
  if (viewport) await page.setViewportSize(viewport);
}

/** Operator-only capture of public/run-owned Customer/Guest pages during real journeys. */
export async function wave3Capture(page: Page, state: string) {
  const directory = process.env.STAGING_WAVE3_CAPTURE_DIR;
  if (!directory || /^(driver|operations|finance|staff)-/.test(state)) return;
  const applicationSha = process.env.ACCEPTANCE_APPLICATION_SHA;
  if (!/^[a-f0-9]{40}$/.test(applicationSha ?? '') || !/^[a-z0-9-]+$/.test(state))
    throw Error('WAVE3_CAPTURE_IDENTITY_REQUIRED');
  await expect(page.locator('main h1')).toBeVisible();
  await expect(page.locator('.skeleton')).toHaveCount(0);
  await expect(page.locator('input[type=password]:visible')).toHaveCount(0);
  const text = await page.locator('main').innerText();
  expect(
    /g1_[a-f0-9]{64}|eyJ[A-Za-z0-9_-]+\.eyJ|https?:\S+(?:token=|\/storage\/v1\/)/i.test(text),
  ).toBe(false);
  mkdirSync(directory, { recursive: true });
  const indexPath = join(directory, 'index.json');
  const rows = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf8')).matrix : [];
  const viewport = page.viewportSize();
  const originalTheme = await page.locator('html').getAttribute('data-theme');
  const locale = await page.locator('html').getAttribute('lang');
  for (const theme of ['light', 'dark', 'system']) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator('.desktop-header-nav .theme-control select').selectOption(theme);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await page.emulateMedia({ colorScheme: 'light' });
    // Full widths for Light; breakpoint extremes for Dark and System.
    const samples = theme === 'light' ? [360, 390, 768, 1280, 1440] : [360, 1440];
    for (const width of samples) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
      const violations = (
        await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
      ).violations;
      if (violations.length) {
        writeFileSync(
          join(directory, `failure-${state}-${locale}-${theme}-${width}.json`),
          JSON.stringify(
            {
              state,
              locale,
              theme,
              width,
              applicationSha,
              result: 'FAIL',
              category: 'AXE',
              rules: violations.map((v) => ({
                id: v.id,
                impact: v.impact,
                targets: v.nodes.map((n) => n.target),
              })),
            },
            null,
            2,
          ),
        );
      }
      expect(violations).toEqual([]);
      const action = page
        .locator(
          'main a:visible, main button:visible:not([disabled]), main input:visible:not([disabled])',
        )
        .first();
      if (await action.count()) {
        await action.focus();
        await expect(action).toBeFocused();
      }
      // Reset focus-induced scrolling before full-page capture; keep fixed offscreen controls out.
      await page.evaluate(() => scrollTo({ top: 0, left: 0, behavior: 'instant' }));
      const filename = `${state}-${locale}-${theme}-${width}.png`;
      const existing = rows.find((r: { filename: string }) => r.filename === filename);
      if (existing) {
        if (
          existing.applicationSha !== applicationSha ||
          createHash('sha256')
            .update(readFileSync(join(directory, filename)))
            .digest('hex') !== existing.sha256
        )
          throw Error('WAVE3_EXISTING_EVIDENCE_INVALID');
        continue;
      }
      const bytes = await page.screenshot({ path: join(directory, filename), fullPage: true });
      rows.push({
        state,
        locale,
        theme,
        width,
        applicationSha,
        source: 'real hosted run-owned journey',
        result: 'PASS',
        overflow: false,
        axeViolations: 0,
        filename,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        capturedAt: new Date().toISOString(),
      });
      writeFileSync(indexPath + '.tmp', JSON.stringify({ applicationSha, matrix: rows }, null, 2));
      renameSync(indexPath + '.tmp', indexPath);
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page
    .locator('.desktop-header-nav .theme-control select')
    .selectOption(originalTheme ?? 'system');
  await page.emulateMedia({ colorScheme: null });
  if (viewport) await page.setViewportSize(viewport);
}

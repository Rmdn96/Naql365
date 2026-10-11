import type { Page } from '@playwright/test';
import { expect } from '../staging/fixtures';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync, renameSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { applicationSha, widths, states } from './matrix';

export async function captureState(
  page: Page,
  state: (typeof states)[number],
  locale: 'ar' | 'en',
  fixtureReference: string,
) {
  const directory = process.env.STAGING_STATE_SCREENSHOTS;
  if (!directory) throw Error('Explicit matrix directory required');
  mkdirSync(directory, { recursive: true });
  if (!state.endsWith('-loading')) await expect(page.locator('main h1')).toBeVisible();
  const indexPath = join(directory, 'index.json');
  const existing = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf8')).matrix : [];
  for (const width of widths) {
    const old = existing.find(
      (r: { state: string; locale: string; viewport: { width: number } }) =>
        r.state === state && r.locale === locale && r.viewport.width === width,
    );
    if (
      old?.result === 'PASS' &&
      old.applicationSha === applicationSha &&
      existsSync(join(directory, old.filename)) &&
      createHash('sha256')
        .update(readFileSync(join(directory, old.filename)))
        .digest('hex') === old.sha256
    )
      continue;
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    for (const input of await page.locator('input[type=password]').all())
      await expect(input).toHaveValue('');
    const text = await page.locator('body').innerText();
    expect(/g1_[a-f0-9]{64}|eyJ[A-Za-z0-9_-]+\.eyJ|https?:\S+token=/i.test(text)).toBe(false);
    const violations = (
      await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    ).violations;
    expect(violations).toEqual([]);
    const target = page
      .locator(
        'main button:visible:not([disabled]), main input:visible:not([type=hidden]), main a:visible',
      )
      .first();
    if (await target.count()) {
      await target.focus();
      await expect(target).toBeFocused();
    }
    const filename = `${locale}-${width}-${state}.png`;
    const bytes = await page.screenshot({ path: join(directory, filename), fullPage: true });
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
          filename,
          sha256: createHash('sha256').update(bytes).digest('hex'),
          fixtureReference,
          overflow: false,
          axeViolations: 0,
          scope: 'Automated layout, axe, focus and capture; synthetic fixture only',
        },
        null,
        2,
      ),
    );
    const row = JSON.parse(
      readFileSync(join(directory, `${locale}-${width}-${state}.json`), 'utf8'),
    );
    const position = existing.findIndex(
      (r: { state: string; locale: string; viewport: { width: number } }) =>
        r.state === state && r.locale === locale && r.viewport.width === width,
    );
    if (position < 0) existing.push(row);
    else existing[position] = row;
    writeFileSync(indexPath + '.tmp', JSON.stringify({ matrix: existing }, null, 2));
    renameSync(indexPath + '.tmp', indexPath);
  }
}

export async function captureBoth(
  page: Page,
  state: (typeof states)[number],
  fixtureReference: string,
) {
  const original = new URL(page.url());
  if (original.hash || original.search) throw Error('Clean state URL required');
  for (const locale of ['ar', 'en'] as const) {
    await page.goto(original.pathname.replace(/^\/(ar|en)\//, `/${locale}/`));
    await captureState(page, state, locale, fixtureReference);
  }
  await page.goto(original.pathname);
}

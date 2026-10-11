import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from '../staging/fixtures';
// Call only on public pages or the current run's owned synthetic identity.
export async function stage1Capture(page: Page, name: string) {
  const directory = process.env.STAGING_UX_SCREENSHOTS;
  if (!directory) return;
  if (!/^[a-z0-9-]+$/.test(name)) throw Error('Invalid screenshot label');
  await expect(page.locator('main h1')).toBeVisible();
  await expect(page.locator('.skeleton')).toHaveCount(0);
  await expect(page.locator('input[type=password]:visible')).toHaveCount(0);
  mkdirSync(directory, { recursive: true });
  const viewport = page.viewportSize();
  for (const width of [360, 390, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (process.env.STAGING_UX_STAGE === '2') {
      expect(
        (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
          .violations,
      ).toEqual([]);
      await page.screenshot({ path: join(directory, `${name}-${width}.png`), fullPage: true });
    }
  }
  if (viewport) await page.setViewportSize(viewport);
  mkdirSync(directory, { recursive: true });
  await page.screenshot({ path: join(directory, `${name}.png`), fullPage: true });
}

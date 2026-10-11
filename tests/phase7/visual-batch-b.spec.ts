import {
  test,
  expect,
  configureProtectedContext,
  holdApplicationScripts,
} from '../staging/fixtures';
import { guestQuote, acceptGuest } from './helpers';
import { admin, login } from '../phase4/helpers';
import { captureBoth, captureState } from '../stage2-states/capture';
import { paymentDictionary } from '../../src/i18n/payments';
import { quotesDictionary } from '../../src/i18n/quotes';
import sharp from 'sharp';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

test('Batch B owned Quote and transfer lifecycle matrix', async ({ page, browser, baseURL }) => {
  const context = await browser.newContext(baseURL ? { baseURL } : {});
  await configureProtectedContext(context, baseURL);
  const staff = await context.newPage();
  try {
    const journey = await guestQuote(page, staff, 'EG');
    await captureBoth(page, 'quote-final', 'run-ledger:EG-guest-quote');
    const quotePath = new URL(page.url()).pathname;
    for (const locale of ['ar', 'en'] as const) {
      await page.waitForLoadState('load');
      const release = holdApplicationScripts(page);
      try {
        await page.goto(quotePath.replace(/^\/(ar|en)\//, `/${locale}/`), { waitUntil: 'commit' });
        await expect(page.locator('.skeleton').first()).toBeVisible();
        await captureState(
          page,
          'quote-loading',
          locale,
          'run-ledger:EG-guest-quote; delayed scripts',
        );
      } finally {
        release();
      }
    }
    await page.goto(quotePath);
    const order = await acceptGuest(page, journey.versionId, 'en');
    await captureBoth(page, 'checkout-method', 'run-ledger:EG-guest-order');
    const t = paymentDictionary('en');
    await page.getByRole('button', { name: `${t.transfer} · TEST InstaPay`, exact: true }).click();
    await expect(page.getByText(t.states.AWAITING_TRANSFER_PROOF, { exact: true })).toBeVisible();
    const buffer = await sharp({
      create: { width: 32, height: 16, channels: 3, background: '#ffffff' },
    })
      .png()
      .toBuffer();
    for (let attempt = 0; attempt < 2; attempt++) {
      await expect(page.locator('#transfer-proof-file')).toBeEnabled();
      await page
        .locator('#transfer-proof-file')
        .setInputFiles({ name: 'test-proof.png', mimeType: 'image/png', buffer });
      await page.getByRole('button', { name: t.upload, exact: true }).click();
      await expect(page.getByText(t.states.UNDER_REVIEW, { exact: true })).toBeVisible();
      if (attempt === 0) await captureBoth(page, 'checkout-proof-pending', 'run-ledger:EG-proof');
      await login(staff, 'finance', 'en');
      await staff.goto(`/en/portal/finance/${order}`);
      if (attempt === 0) {
        await staff.locator('#payment-reason').fill('TEST clearer proof required');
        await staff.getByRole('button', { name: t.reject, exact: true }).click();
        await expect(staff.getByText(t.states.TRANSFER_REJECTED, { exact: true })).toBeVisible();
        await page.reload();
        await expect(page.getByText('TEST clearer proof required', { exact: true })).toBeVisible();
        await captureBoth(page, 'checkout-proof-retry', 'run-ledger:EG-proof');
      } else {
        await staff.getByRole('button', { name: t.confirmTransfer, exact: true }).click();
        await expect(staff.getByText(t.states.PAID, { exact: true })).toBeVisible();
        await page.reload();
        await expect(page.getByText(t.states.PAID, { exact: true })).toBeVisible();
        await captureBoth(page, 'checkout-confirmed', 'run-ledger:EG-proof');
      }
    }
  } finally {
    await context.close();
  }
});

test('Batch B rejected Quote matrix', async ({ page, browser, baseURL }) => {
  const directory = process.env.STAGING_STATE_SCREENSHOTS!;
  const rows = JSON.parse(readFileSync(join(directory, 'index.json'), 'utf8')).matrix.filter(
    (r: { state: string }) => r.state === 'quote-rejected-expired-error',
  );
  test.skip(
    rows.length === 10 &&
      rows.every(
        (r: { result: string; filename: string; sha256: string }) =>
          r.result === 'PASS' &&
          existsSync(join(directory, r.filename)) &&
          createHash('sha256')
            .update(readFileSync(join(directory, r.filename)))
            .digest('hex') === r.sha256,
      ),
    'Accepted rejected-Quote captures already complete and hash-valid',
  );
  const context = await browser.newContext(baseURL ? { baseURL } : {});
  await configureProtectedContext(context, baseURL);
  try {
    const journey = await guestQuote(page, await context.newPage(), 'SA');
    page.once('dialog', (d) => void d.accept());
    await page.locator('#rejection-reason').fill('TEST declined');
    await page.getByRole('button', { name: quotesDictionary('ar').reject, exact: true }).click();
    await expect
      .poll(
        async () =>
          (await admin.from('quote_versions').select('status').eq('id', journey.versionId).single())
            .data?.status,
      )
      .toBe('REJECTED');
    await captureBoth(page, 'quote-rejected-expired-error', 'run-ledger:SA-rejected-quote');
  } finally {
    await context.close();
  }
});

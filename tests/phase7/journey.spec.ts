import { test, expect, configureProtectedContext } from '../staging/fixtures';
import { guestQuote, acceptGuest, executeDelivery } from './helpers';
import { admin, login, axe, principal } from '../phase4/helpers';
import { paymentDictionary } from '../../src/i18n/payments';
import { quotesDictionary } from '../../src/i18n/quotes';
import { guestDictionary } from '../../src/i18n/guest';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';

for (const country of ['SA', 'EG'] as const)
  test(`${country} guest Request to delivery without registration`, async ({
    page,
    browser,
    baseURL,
  }) => {
    const staffContext = await browser.newContext();
    await configureProtectedContext(staffContext, baseURL);
    const staff = await staffContext.newPage();
    try {
      await page.setViewportSize({ width: 390, height: 844 });
      const journey = await guestQuote(page, staff, country),
        { locale } = journey;
      const t = paymentDictionary(locale);
      const order = await acceptGuest(page, journey.versionId, locale);
      const original = (
        await admin
          .from('orders')
          .select('total_minor,currency,accepted_quote_version_id')
          .eq('id', order)
          .single()
      ).data;
      for (const width of [360, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await axe(page);
      }
      await page.setViewportSize({ width: 390, height: 844 });
      const guest = createClient(
        process.env.STAGING_TEST_API_URL!,
        process.env.STAGING_TEST_PUBLIC_KEY!,
        {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { 'x-naql365-guest': journey.token } },
        },
      );
      const missing = createClient(
        process.env.STAGING_TEST_API_URL!,
        process.env.STAGING_TEST_PUBLIC_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      expect((await missing.rpc('payment_details', { p_order: order })).error).not.toBeNull();
      expect((await guest.rpc('payment_details', { p_order: randomUUID() })).error).not.toBeNull();
      expect(
        (
          await guest.rpc('payment_command', {
            p_order: order,
            p_action: 'confirm_cash',
            p_mutation: randomUUID(),
            p_revision: 0,
            p_payload: {},
          })
        ).error,
      ).not.toBeNull();
      expect((await guest.from('payment_transactions').select('*')).error).not.toBeNull();
      if (country === 'SA') {
        await page.getByRole('button', { name: t.cash, exact: true }).click();
        await expect(page.getByText(t.states.CASH_DUE, { exact: true })).toBeVisible();
      } else {
        await page
          .getByRole('button', { name: `${t.transfer} · TEST InstaPay`, exact: true })
          .click();
        await expect(
          page.getByText(t.states.AWAITING_TRANSFER_PROOF, { exact: true }),
        ).toBeVisible();
        const buffer = await sharp({
          create: { width: 32, height: 16, channels: 3, background: '#ffffff' },
        })
          .png()
          .toBuffer();
        for (let attempt = 0; attempt < 2; attempt++) {
          await page
            .locator('#transfer-proof-file')
            .setInputFiles({ name: 'test-proof.png', mimeType: 'image/png', buffer });
          await page.getByRole('button', { name: t.upload, exact: true }).click();
          await expect(page.getByText(t.states.UNDER_REVIEW, { exact: true })).toBeVisible();
          const payment = (
            await admin
              .from('payments')
              .select('id,revision,amount_minor,currency')
              .eq('order_id', order)
              .single()
          ).data!;
          const proof = (
            await admin
              .from('bank_transfer_attempts')
              .select('id,bank_snapshot,file_id')
              .eq('payment_id', payment.id)
              .eq('state', 'SUBMITTED')
              .single()
          ).data!;
          expect((proof.bank_snapshot as { destinationType: string }).destinationType).toBe(
            'INSTAPAY',
          );
          const file = await admin
            .from('file_objects')
            .select('object_name')
            .eq('id', proof.file_id)
            .single();
          expect(file.error).toBeNull();
          const path = file.data!.object_name;
          expect(
            (await missing.storage.from('documents').createSignedUrl(path, 2)).error,
          ).not.toBeNull();
          expect(
            (await (await principal('peer')).storage.from('documents').createSignedUrl(path, 2))
              .error,
          ).not.toBeNull();
          const signed = await guest.storage.from('documents').createSignedUrl(path, 2);
          expect(signed.error).toBeNull();
          expect((await fetch(signed.data!.signedUrl)).ok).toBe(true);
          await new Promise((resolve) => setTimeout(resolve, 3100));
          expect(
            (await fetch(signed.data!.signedUrl, { headers: { 'Cache-Control': 'no-cache' } })).ok,
          ).toBe(false);
          expect(
            (
              await fetch(
                `${process.env.STAGING_TEST_API_URL}/storage/v1/object/public/documents/${path}`,
              )
            ).ok,
          ).toBe(false);
          await login(staff, 'finance', locale);
          await staff.goto(`/${locale}/portal/finance/${order}`);
          if (attempt === 0) {
            await staff.locator('#payment-reason').fill('TEST clearer proof required');
            await staff.getByRole('button', { name: t.reject, exact: true }).click();
            await expect(
              staff.getByText(t.states.TRANSFER_REJECTED, { exact: true }),
            ).toBeVisible();
            await page.reload();
            await expect(
              page.getByText('TEST clearer proof required', { exact: true }),
            ).toBeVisible();
          } else {
            await staff.getByRole('button', { name: t.confirmTransfer, exact: true }).click();
            await expect(staff.getByText(t.states.PAID, { exact: true })).toBeVisible();
            await page.reload();
            await expect(page.getByText(t.states.PAID, { exact: true })).toBeVisible();
          }
        }
      }
      await executeDelivery(staff, order, country, journey.market.id, journey.cityId);
      await page.goto(`/${locale}/guest/orders/${order}`);
      await axe(page);
      const progress = await guest.rpc('customer_order_progress', { p_order_id: order });
      expect(progress.error).toBeNull();
      expect(progress.data.status).toBe('COMPLETED');
      const safe = JSON.stringify(progress.data);
      for (const forbidden of [
        '@',
        'latitude',
        'longitude',
        'finance_note',
        'assignment',
        'guest_grant',
        'private',
      ])
        expect(safe.includes(forbidden)).toBe(false);
      const link = page.locator('main a[data-market-country]');
      const href = await link.getAttribute('href');
      expect(href?.includes(journey.token)).toBe(false);
      expect(new URL(href!).pathname).toBe(country === 'SA' ? '/966558985250' : '/201009402374');
      expect(
        (
          await admin
            .from('orders')
            .select('total_minor,currency,accepted_quote_version_id')
            .eq('id', order)
            .single()
        ).data,
      ).toEqual(original);
      await login(staff, 'sales', locale);
      await staff.goto(`/${locale}/portal/quotes/${journey.requestId}`);
      const replacement = staff.waitForResponse(
        (r) => new URL(r.url()).pathname === '/api/sales/guest-link',
      );
      await staff
        .getByRole('button', { name: guestDictionary(locale).replaceLink, exact: true })
        .click();
      const replaced = (await (await replacement).json()) as { token: string };
      expect((await guest.rpc('guest_access_state')).error).not.toBeNull();
      await page.goto(`/${locale}/guest#${replaced.token}`);
      await expect(page).toHaveURL(new RegExp(`/guest/requests/${journey.requestId}$`));
      expect(await page.content()).not.toContain(replaced.token);
      await staff
        .getByRole('button', { name: guestDictionary(locale).revokeLink, exact: true })
        .click();
      await expect(staff.getByText(guestDictionary(locale).revoked, { exact: true })).toBeVisible();
      await page.reload();
      await expect(
        page.getByText(guestDictionary(locale).unavailable, { exact: true }),
      ).toBeVisible();
    } finally {
      await staffContext.close();
    }
  });

test('guest rejects sent Quote without creating an Order', async ({ page, browser, baseURL }) => {
  const context = await browser.newContext();
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
    expect(
      (await admin.from('orders').select('id').eq('request_id', journey.requestId)).data,
    ).toEqual([]);
  } finally {
    await context.close();
  }
});

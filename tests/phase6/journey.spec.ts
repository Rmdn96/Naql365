import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import type { Page } from '@playwright/test';
import { test, expect } from '../staging/fixtures';
import {
  acceptedOrder,
  admin,
  org,
  identities,
  login,
  logout,
  axe,
  principal,
  op,
} from '../phase4/helpers';
import { dictionary } from '../../src/i18n/dictionaries';
import { paymentDictionary } from '../../src/i18n/payments';
import { customerDictionary } from '../../src/i18n/customer';
import { driverDictionary } from '../../src/i18n/driver';
test('hosted bank configuration is privileged, localized and revisioned', async ({ page }) => {
  const banks = await admin
    .from('bank_accounts')
    .select('id,revision')
    .eq('created_by', identities.bankAdmin!.id)
    .order('created_at');
  expect(banks.error).toBeNull();
  expect(banks.data).toHaveLength(2);
  await login(page, 'finance', 'en');
  const denied = await page.goto('/en/portal/finance/banks');
  test.info().annotations.push({
    type: 'safe-security-probe',
    description: 'bank-page-denial-status=' + denied?.status(),
  });
  // App Router may stream the response before notFound; verify the denial content and RPC authority.
  await expect(
    page.getByRole('heading', { name: dictionary('en').notFound, exact: true }),
  ).toBeVisible();
  await expect(page.locator('form')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('TEST-ONLY-');
  const finance = await principal('finance');
  expect(
    (
      await finance.rpc('has_permission', {
        organization_id: org,
        permission_code: 'finance.accounts.manage',
      })
    ).data,
  ).toBe(false);
  await logout(page, 'en');
  await login(page, 'bankAdmin', 'en');
  await page.goto('/en/portal/finance/banks');
  await axe(page);
  const bank = banks.data![0]!;
  const field = page.locator(`[id="${bank.id}-instructionsEn"]`);
  await field.fill('STAGING TEST ONLY. Transfer the exact accepted total.');
  await page
    .locator('form')
    .filter({ has: field })
    .getByRole('button', { name: paymentDictionary('en').saveBank, exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await admin.from('bank_accounts').select('revision').eq('id', bank.id).single()).data
          ?.revision,
    )
    .toBe(bank.revision + 1);
  await page.goto('/ar/portal/finance/banks');
  await axe(page);
  await logout(page);
});
function proofPdf() {
  let content = '%PDF-1.4\n';
  const offsets = [0];
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >>',
    '<< /Length 0 >>\nstream\n\nendstream',
  ];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(content));
    content += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(content);
  content +=
    'xref\n0 5\n0000000000 65535 f \n' +
    offsets
      .slice(1)
      .map((n) => `${String(n).padStart(10, '0')} 00000 n \n`)
      .join('');
  content += `trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(content);
}
async function payment(orderId: string) {
  const r = await admin.from('payments').select('*').eq('order_id', orderId).single();
  expect(r.error).toBeNull();
  return r.data!;
}
async function command(
  page: Page,
  orderId: string,
  action: string,
  payload: object,
  expected = 200,
  mutationId = randomUUID(),
) {
  const p = await payment(orderId);
  const status = await page.evaluate(
    async (body) =>
      (
        await fetch('/api/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      ).status,
    { orderId, action, payload, mutationId, revision: p.revision },
  );
  expect(status).toBe(expected);
}
for (const country of ['SA', 'EG'] as const)
  for (const method of ['CASH', 'BANK_TRANSFER'] as const) {
    test(`${country} ${method}: hosted checkout, Finance, execution clearance, isolation and receipt`, async ({
      page,
    }) => {
      const locale = country === 'SA' ? 'ar' : 'en',
        t = paymentDictionary(locale);
      const accepted = await acceptedOrder(page, country, 'customer', null),
        { orderId, market, cityId } = accepted;
      const before = await admin.from('orders').select('*').eq('id', orderId).single();
      expect(before.error).toBeNull();
      await page.goto(`/${locale}/account/orders/${orderId}/payment`);
      await page.setViewportSize({ width: 390, height: 844 });
      expect(await page.locator('html').getAttribute('dir')).toBe(locale === 'ar' ? 'rtl' : 'ltr');
      await axe(page);
      await page
        .getByRole('button', { name: method === 'CASH' ? t.cash : t.transfer, exact: true })
        .click();
      await expect(
        page.getByText(t.states[method === 'CASH' ? 'CASH_DUE' : 'AWAITING_TRANSFER_PROOF'], {
          exact: true,
        }),
      ).toBeVisible();
      let p = await payment(orderId);
      expect(p.currency).toBe(country === 'SA' ? 'SAR' : 'EGP');
      expect(p.status).not.toBe('PAID');
      expect(p.amount_minor).toBe(before.data!.total_minor);
      // Customer metadata deliberately claims SUPER_ADMIN; database roles still win.
      await command(
        page,
        orderId,
        'confirm_cash',
        { amountMinor: p.amount_minor, currency: p.currency },
        403,
      );
      await command(
        page,
        orderId,
        'choose',
        { method, currency: country === 'SA' ? 'EGP' : 'SAR' },
        400,
      );
      const owner = await principal('customer'),
        peer = await principal('peer'),
        foreign = await principal('otherFinance');
      expect((await peer.rpc('payment_details', { p_order: orderId })).error).not.toBeNull();
      expect((await foreign.rpc('payment_details', { p_order: orderId })).error).not.toBeNull();
      expect((await peer.from('payments').select('id').eq('id', p.id)).data).toEqual([]);
      for (const role of ['sales', 'operations', 'saDriverA', 'otherFinance']) {
        const c = await principal(role);
        expect(
          (
            await c.rpc('payment_command', {
              p_order: orderId,
              p_action: 'confirm_cash',
              p_mutation: randomUUID(),
              p_revision: p.revision,
              p_payload: { amountMinor: p.amount_minor, currency: p.currency },
            })
          ).error,
        ).not.toBeNull();
      }
      await logout(page, locale);
      await login(page, 'operations', locale);
      const job = await op(page, 'create_job', orderId),
        trip = await op(page, 'create_trip', job);
      const driver = await op(page, 'create_driver', org, {
        marketId: market.id,
        type: 'INTERNAL',
        name: `PHASE6 TEST ${country} ${method}`,
      });
      const driverRole = `${country === 'SA' ? 'saDriver' : 'egDriver'}${method === 'CASH' ? 'A' : 'B'}`;
      expect(
        (
          await admin
            .from('drivers')
            .update({ profile_id: identities[driverRole]!.id })
            .eq('id', driver)
        ).error,
      ).toBeNull();
      const vehicle = await op(page, 'create_vehicle', org, {
        marketId: market.id,
        type: 'Truck',
        identifier: `P6-${country}-${method}-${randomUUID().slice(0, 6)}`,
      });
      await op(page, 'plan', trip, {
        plannedStart: new Date(Date.now() + 3600000).toISOString(),
        plannedEnd: new Date(Date.now() + 7200000).toISOString(),
        stops: [
          { cityId, kind: 'PICKUP', address: 'Controlled pickup only', pickups: [] },
          { cityId, kind: 'DELIVERY', address: 'Controlled delivery only', pickups: [0] },
        ],
      });
      await op(page, 'assign', trip, { driverId: driver, vehicleId: vehicle });
      await op(page, 'ready', trip);
      if (method === 'BANK_TRANSFER') await op(page, 'dispatch', trip, {}, 400);
      await logout(page, locale);
      await page.goto(`/${locale}/driver/login`);
      await page.locator('#driver-email').fill(identities[driverRole]!.email);
      await page.locator('#driver-password').fill(identities[driverRole]!.password);
      await page
        .getByRole('button', { name: customerDictionary(locale).login, exact: true })
        .click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/driver$`));
      await page.goto(`/${locale}/driver/trips/${trip}`);
      const dt = driverDictionary(locale);
      if (method === 'BANK_TRANSFER') {
        await expect(page.getByRole('button', { name: dt.startTrip, exact: true })).toBeDisabled();
        await expect(page.getByText(t.executionBlocked, { exact: true })).toBeVisible();
        const c = await principal(driverRole),
          rev = await admin.from('trips').select('revision').eq('id', trip).single();
        expect(
          (
            await c.rpc('driver_execute', {
              p_trip: trip,
              p_action: 'dispatch',
              p_revision: rev.data!.revision,
              p_mutation: randomUUID(),
              p_payload: {},
            })
          ).error,
        ).not.toBeNull();
      } else {
        await page.getByRole('button', { name: dt.startTrip, exact: true }).click();
        await expect
          .poll(
            async () =>
              (await admin.from('trips').select('started_at').eq('id', trip).single()).data
                ?.started_at,
          )
          .not.toBeNull();
        expect((await payment(orderId)).status).toBe('CASH_DUE');
      }
      await axe(page);
      await logout(page, locale);
      await login(page, 'customer', locale);
      await page.goto(`/${locale}/account/orders/${orderId}/payment`);
      if (method === 'CASH')
        await command(page, orderId, 'choose', { method: 'BANK_TRANSFER' }, 409);
      let attemptId: string | undefined;
      if (method === 'BANK_TRANSFER') {
        await page.locator('#transfer-proof-file').setInputFiles({
          name: 'malformed.png',
          mimeType: 'image/png',
          buffer: Buffer.from('not an image'),
        });
        try {
          await page.getByRole('button', { name: t.upload, exact: true }).click();
        } catch (error) {
          test.info().annotations.push({
            type: 'safe-security-probe',
            description: JSON.stringify({
              uploadButtons: await page
                .getByRole('button', { name: t.upload, exact: true })
                .count(),
              retryButtons: await page.getByRole('button', { name: t.retry, exact: true }).count(),
              file: await page
                .locator('#transfer-proof-file')
                .evaluate((e: HTMLInputElement) => ({
                  files: e.files?.length,
                  disabled: e.disabled,
                })),
              uploadDisabled: await page
                .getByRole('button', { name: t.upload, exact: true })
                .isDisabled()
                .catch(() => null),
            }),
          });
          throw error;
        }
        await expect(page.getByRole('alert').filter({ hasText: t.error })).toBeVisible();
        expect(
          (await admin.from('bank_transfer_attempts').select('id').eq('payment_id', p.id)).data,
        ).toEqual([]);
        await expect(
          page
            .getByText('STAGING TEST ONLY', { exact: true })
            .or(page.getByText('حساب اختبار فقط', { exact: true })),
        ).toBeVisible();
        const png = await sharp({
          create: { width: 32, height: 16, channels: 3, background: '#ffffff' },
        })
          .png()
          .toBuffer();
        await page
          .locator('#transfer-proof-file')
          .setInputFiles({ name: 'proof.png', mimeType: 'image/png', buffer: png });
        await page.getByRole('button', { name: t.upload, exact: true }).click();
        await expect(page.getByText(t.states.UNDER_REVIEW, { exact: true })).toBeVisible();
        p = await payment(orderId);
        expect(p.status).toBe('UNDER_REVIEW');
        const attempt = await admin
          .from('bank_transfer_attempts')
          .select('*,file_objects(object_name,bucket_id)')
          .eq('payment_id', p.id)
          .single();
        expect(attempt.error).toBeNull();
        attemptId = attempt.data!.id;
        const path = attempt.data!.file_objects!.object_name;
        expect(
          (await peer.storage.from('documents').createSignedUrl(path, 10)).error,
        ).not.toBeNull();
        expect(
          (await foreign.storage.from('documents').createSignedUrl(path, 10)).error,
        ).not.toBeNull();
        expect(
          (
            await (
              await principal('operations')
            ).storage
              .from('documents')
              .createSignedUrl(path, 10)
          ).error,
        ).not.toBeNull();
        expect(
          (
            await page.request.get(
              `${process.env.STAGING_TEST_API_URL}/storage/v1/object/public/documents/${path}`,
            )
          ).ok(),
        ).toBe(false);
        const signed = await owner.storage.from('documents').createSignedUrl(path, 2);
        expect(signed.error).toBeNull();
        expect((await page.request.get(signed.data!.signedUrl)).ok()).toBe(true);
        await new Promise((resolve) => setTimeout(resolve, 3100));
        expect(
          (
            await page.request.get(signed.data!.signedUrl, {
              headers: { 'Cache-Control': 'no-cache' },
            })
          ).ok(),
        ).toBe(false);
        await command(page, orderId, 'choose', { method: 'CASH' }, 409);
        await logout(page, locale);
        await login(page, 'finance', locale);
        await page.goto(`/${locale}/portal/finance/${orderId}`);
        await axe(page);
        await command(page, orderId, 'reject_transfer', { attemptId, reason: '' }, 400);
        const download = await page.evaluate(async (id) => {
          const response = await fetch(`/api/payments/proof/${id}`);
          const data = (await response.json()) as { url?: string };
          return { status: response.status, url: data.url };
        }, attemptId!);
        expect(download.status).toBe(200);
        expect((await page.request.get(download.url!)).ok()).toBe(true);
        await page.locator('#payment-note').fill('PRIVATE FINANCE TEST NOTE');
        await page.locator('#payment-reason').fill('Please upload a readable transfer proof');
        await page.getByRole('button', { name: t.reject, exact: true }).click();
        await expect(page.getByText(t.states.TRANSFER_REJECTED, { exact: true })).toBeVisible();
        await logout(page, locale);
        await login(page, 'customer', locale);
        await page.goto(`/${locale}/account/orders/${orderId}/payment`);
        await expect(
          page.getByText('Please upload a readable transfer proof', { exact: true }),
        ).toBeVisible();
        await expect(page.locator('body')).not.toContainText('PRIVATE FINANCE TEST NOTE');
        await page.locator('#transfer-proof-file').setInputFiles({
          name: country === 'EG' ? 'replacement.pdf' : 'replacement.png',
          mimeType: country === 'EG' ? 'application/pdf' : 'image/png',
          buffer: country === 'EG' ? proofPdf() : png,
        });
        await page.getByRole('button', { name: t.upload, exact: true }).click();
        await expect(page.getByText(t.states.UNDER_REVIEW, { exact: true })).toBeVisible();
        const history = await admin
          .from('bank_transfer_attempts')
          .select('id,state')
          .eq('payment_id', p.id)
          .order('attempt_number');
        expect(history.error).toBeNull();
        expect(history.data).toHaveLength(2);
        expect(history.data![0]!.state).toBe('REJECTED');
        attemptId = history.data![1]!.id;
      }
      await logout(page, locale);
      await login(page, 'finance', locale);
      await page.goto(`/${locale}/portal/finance`);
      await axe(page);
      await page.getByRole('link', { name: before.data!.reference!, exact: true }).click();
      p = await payment(orderId);
      const action = method === 'CASH' ? 'confirm_cash' : 'confirm_transfer';
      await command(
        page,
        orderId,
        action,
        {
          ...(attemptId ? { attemptId } : {}),
          amountMinor: p.amount_minor,
          currency: country === 'SA' ? 'EGP' : 'SAR',
        },
        400,
      );
      expect(
        (
          await admin
            .from('organization_memberships')
            .update({ status: 'suspended' })
            .eq('profile_id', identities.finance!.id)
            .eq('organization_id', org)
        ).error,
      ).toBeNull();
      await command(
        page,
        orderId,
        action,
        { ...(attemptId ? { attemptId } : {}), amountMinor: p.amount_minor, currency: p.currency },
        403,
      );
      expect(
        (
          await admin
            .from('organization_memberships')
            .update({ status: 'active' })
            .eq('profile_id', identities.finance!.id)
            .eq('organization_id', org)
        ).error,
      ).toBeNull();
      await page
        .getByRole('button', {
          name: method === 'CASH' ? t.confirmCash : t.confirmTransfer,
          exact: true,
        })
        .click();
      await expect(page.getByText(t.states.PAID, { exact: true })).toBeVisible();
      const receipts = await admin
        .from('invoices')
        .select('total_minor,currency')
        .eq('payment_id', p.id);
      expect(receipts.error).toBeNull();
      expect(receipts.data).toHaveLength(1);
      expect(receipts.data![0]).toEqual({ total_minor: p.amount_minor, currency: p.currency });
      const notices = await owner.from('notifications').select('event_code').eq('payment_id', p.id);
      expect(notices.error).toBeNull();
      expect(notices.data?.map((n) => n.event_code)).toContain(
        method === 'CASH' ? 'CASH_RECEIVED' : 'TRANSFER_CONFIRMED',
      );
      if (method === 'BANK_TRANSFER')
        expect(notices.data?.map((n) => n.event_code)).toContain('TRANSFER_REJECTED');
      expect((await peer.from('notifications').select('id').eq('payment_id', p.id)).data).toEqual(
        [],
      );
      await logout(page, locale);
      await page.goto(`/${locale}/driver/login`);
      await page.locator('#driver-email').fill(identities[driverRole]!.email);
      await page.locator('#driver-password').fill(identities[driverRole]!.password);
      await page
        .getByRole('button', { name: customerDictionary(locale).login, exact: true })
        .click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/driver$`));
      await page.goto(`/${locale}/driver/trips/${trip}`);
      if (method === 'BANK_TRANSFER') {
        await expect(page.getByRole('button', { name: dt.startTrip, exact: true })).toBeEnabled();
        await page.getByRole('button', { name: dt.startTrip, exact: true }).click();
        await expect
          .poll(
            async () =>
              (await admin.from('trips').select('started_at').eq('id', trip).single()).data
                ?.started_at,
          )
          .not.toBeNull();
      }
      await expect(page.locator('body')).not.toContainText('STAGING TEST ONLY');
      await expect(page.locator('body')).not.toContainText('PRIVATE FINANCE TEST NOTE');
      const after = await admin.from('orders').select('*').eq('id', orderId).single();
      for (const field of [
        'currency',
        'total_minor',
        'subtotal_minor',
        'vat_amount_minor',
        'accepted_quote_version_id',
        'distance_km',
      ])
        expect(after.data![field]).toEqual(before.data![field]);
      await logout(page, locale);
      await login(page, 'customer', locale);
      await page.goto(`/${locale}/account/orders/${orderId}/payment`);
      await expect(page.getByText(t.states.PAID, { exact: true })).toBeVisible();
      await axe(page);
      test.info().annotations.push({
        type: 'phase6-evidence',
        description: `${country}/${method}: hosted Quote→Order→Checkout→Finance→Driver start, private proof where applicable, immutable facts and receipt`,
      });
      await logout(page, locale);
    });
  }

import { stage1Capture } from '../helpers/stage1-evidence';
import { test, expect } from '../staging/fixtures';
import { wave3LoadingCapture } from '../helpers/wave3-evidence';
import { acceptedOrder, admin, org } from '../phase4/helpers';
import { dictionary } from '../../src/i18n/dictionaries';
for (const country of ['SA', 'EG'] as const)
  test(`${country} registered customer manual quote and CASH regression`, async ({ page }) => {
    const market = await admin
      .from('markets')
      .select('id')
      .eq('organization_id', org)
      .eq('country_code', country)
      .single();
    const mode = await admin
      .from('pricing_settings')
      .select('pricing_mode')
      .eq('market_id', market.data!.id)
      .eq('organization_id', org)
      .single();
    expect(mode.data?.pricing_mode).toBe('MANUAL');
    await page.setViewportSize({ width: 390, height: 844 });
    const journey = await acceptedOrder(page, country);
    const details = await admin
      .from('quote_pricing_details')
      .select('pricing_mode,evaluation_id,manual_subtotal_minor')
      .eq('quote_version_id', journey.versionId)
      .single();
    expect(details.data).toEqual({
      pricing_mode: 'MANUAL',
      evaluation_id: null,
      manual_subtotal_minor: 12345,
    });
    const status = await page.evaluate(
      async (requestId) =>
        (
          await fetch('/api/sales/quotes/manual', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              requestId,
              expectedRevision: 0,
              subtotalMinor: 1,
              distanceKm: 1,
              sourceNote: '',
              validitySeconds: 1000,
              mutationId: crypto.randomUUID(),
            }),
          })
        ).status,
      journey.requestId,
    );
    expect(status).toBe(403);
    if (process.env.STAGING_WAVE3_CAPTURE_DIR) {
      await page.goto(`/ar/account/orders/${journey.orderId}/payment`);
      await stage1Capture(page, `customer-cash-${country.toLowerCase()}-ar`);
      await page.goto(`/en/account/quotes/${journey.versionId}`);
      await stage1Capture(page, `customer-accepted-quote-${country.toLowerCase()}-en`);
      await page.goto(`/ar/account/requests/${journey.requestId}`);
      await stage1Capture(page, `customer-request-details-${country.toLowerCase()}-ar`);
      await page.goto('/en/account/requests');
      await stage1Capture(page, `request-history-${country.toLowerCase()}-en`);
      await page.goto('/ar/account/quotes');
      await stage1Capture(page, `quote-history-${country.toLowerCase()}-ar`);
      for (const locale of ['ar', 'en'] as const) {
        await wave3LoadingCapture(page, `account-loading-${country.toLowerCase()}`, locale);
        await expect(page.locator('main h1')).toBeVisible();
      }
    }
    await page.goto('/en');
    await page.goto('/en/login');
    await expect(page).toHaveURL(/\/en\/account$/);
    await page.reload();
    await expect(page).toHaveURL(/\/en\/account$/);
    await stage1Capture(page, `customer-${country.toLowerCase()}-en`);
    await page.getByRole('button', { name: dictionary('en').logout, exact: true }).click();
    await expect(page).toHaveURL(/\/en\/login$/);
    await page.goto('/en/account');
    await expect(page).toHaveURL(/\/en\/login$/);
  });

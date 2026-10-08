import { stage1Capture } from '../helpers/stage1-evidence';
import { test, expect } from '../staging/fixtures';
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

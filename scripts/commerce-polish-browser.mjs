import { expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startBrowserServer, stopBrowserServer } from './browser-server.mjs';

// References an approved local fixture only. The calling harness rejects hosted Supabase URLs.
export function seedPolishCatalog(sql) {
  sql(`
begin;
do $fixture$
declare
  listing private.store_product_market_listings;
  product private.store_products;
  offer private.store_supplier_offers;
  price private.store_market_prices;
  category uuid := gen_random_uuid();
  item record;
begin
  select * into strict listing from private.store_product_market_listings
    where id='98000000-0000-4000-8000-000000000003';
  insert into private.store_categories(id,organization_id,slug,draft_content,public_content,status)
    values(category,listing.organization_id,'fixture-packing',
      '{"title_ar":"مستلزمات التغليف","title_en":"Packing supplies"}',
      '{"title_ar":"مستلزمات التغليف","title_en":"Packing supplies"}','PUBLISHED');
  for item in select * from (values
    ('archive-carton','صندوق أرشفة','Archive carton',9500,true),
    ('book-carton','صندوق كتب مقوّى','Reinforced book carton',6500,true),
    ('packing-paper','ورق تغليف للأواني والأغراض القابلة للكسر','Packing paper for fragile items',4800,false),
    ('packing-tape','شريط تغليف عريض','Wide packing tape',3500,false),
    ('wardrobe-carton','صندوق تخزين للملابس','Wardrobe storage carton',12500,true)
  ) as entries(slug,ar,en,amount,has_image)
  loop
    insert into private.store_products(organization_id,category_id,sku,slug,draft_content)
      values(listing.organization_id,category,item.slug,item.slug,
        jsonb_build_object('title_ar',item.ar,'title_en',item.en))
      returning * into product;
    insert into private.store_product_market_listings(organization_id,market_id,currency,product_id)
      values(listing.organization_id,listing.market_id,listing.currency,product.id)
      returning id into price.listing_id;
    insert into private.store_supplier_offers(
      organization_id,market_id,currency,product_id,supplier_id,agreement_id,offer_key,version,
      unit_cost_minor,evidence_ref,status,effective_from,approved_by,approved_at)
      select organization_id,market_id,currency,product.id,supplier_id,agreement_id,offer_key,version,
        unit_cost_minor,evidence_ref,status,effective_from,approved_by,approved_at
      from private.store_supplier_offers where id=listing.selected_offer_id
      returning * into offer;
    insert into private.store_market_prices(
      organization_id,market_id,currency,listing_id,version,amount_minor,presentation_policy_id,
      status,effective_from,approved_by,approved_at)
      select organization_id,market_id,currency,price.listing_id,version,item.amount,presentation_policy_id,
        status,effective_from,approved_by,approved_at
      from private.store_market_prices where id=listing.selected_price_id
      returning * into price;
    update private.store_product_market_listings
      set selected_price_id=price.id,selected_offer_id=offer.id,identity_policy_id=listing.identity_policy_id,
        delivery_policy_id=listing.delivery_policy_id,returns_policy_id=listing.returns_policy_id,
        published_content=product.draft_content,published_product_revision=product.revision,
        published_category_id=category,status='PUBLISHED',revision=revision+1,
        approved_media=case when item.has_image then jsonb_build_array(jsonb_build_object(
          'src','/store-assets/packing-carton-test-v1.png','altAr',item.ar,'altEn',item.en))
          else '[]'::jsonb end
      where id=price.listing_id;
  end loop;
end
$fixture$;
commit;`);
}

export async function capturePolishView(page, origin, output, { route, width, theme, file }) {
  await page.setViewportSize({ width, height: 900 });
  await page.context().addCookies([{ name: 'naql365_theme', value: theme, url: origin }]);
  const response = await page.goto(origin + route);
  expect(response?.status()).toBe(200);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await expect(page.locator('h1').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    width + 1,
  );
  await page.screenshot({ path: join(output, file + '.png'), fullPage: true });
}

export async function capturePolishStorefront(page, origin, output, capture, checks) {
  for (const locale of ['ar', 'en']) {
    for (const width of [320, 390, 768, 1440]) {
      for (const theme of ['light', 'dark']) {
        await page.goto(origin + '/' + locale);
        await capture(page, locale, width, theme, 'polished-home');
        await expect(page.locator('.launch-main-nav > a')).toHaveCount(4);
        await expect(page.getByRole('searchbox')).toBeVisible();
        await expect(page.locator('.launch-main-nav .commerce-cart')).toBeInViewport();
        await expect(page.locator('.launch-contact a[href^="https://wa.me/"]')).toBeVisible();
        await expect(page.locator('.launch-footer a[href^="tel:"]')).toBeVisible();
        const cards = page.locator('.store-product');
        await expect(cards).toHaveCount(6);
        const first = await cards.nth(0).boundingBox();
        const second = await cards.nth(1).boundingBox();
        expect(first.y, 'Products should start in the upper half of the viewport').toBeLessThan(
          450,
        );
        const [brand, tools] = await Promise.all([
          page.locator('.launch-header .naql-brand').boundingBox(),
          page.locator('.launch-header-tools').boundingBox(),
        ]);
        const overlap = brand.x < tools.x + tools.width && tools.x < brand.x + brand.width;
        expect(overlap, 'Brand and account controls must not overlap').toBe(false);
        if (width === 320) expect(second.y).toBeGreaterThan(first.y);
        else expect(first.y).toBe(second.y);
        await expect(cards.nth(0).getByRole('button')).toBeInViewport();
      }
    }
    for (const [width, theme] of [
      [390, 'light'],
      [1440, 'dark'],
    ]) {
      await capturePolishView(page, origin, output, {
        route: '/' + locale + '/request',
        width,
        theme,
        file: locale + '-' + width + '-' + theme + '-transport',
      });
      await expect(page.locator('#guest-country')).toHaveValue('EG');
      await page.goto(origin + '/' + locale);
      await page.locator('.store-product').first().getByRole('button').click();
      await capturePolishView(page, origin, output, {
        route: '/' + locale + '/store/cart',
        width,
        theme,
        file: locale + '-' + width + '-' + theme + '-cart-checkout',
      });
      await expect(page.locator('.launch-order-summary')).toBeVisible();
      await expect(
        page.locator('#guest-checkout select[name="payment_method"] option'),
      ).toHaveCount(2);
    }
  }
  checks.push(
    'Six-product storefront: AR/EN, 320/390/768/1440, light and dark; shared transport and checkout',
  );
}

const baselineCommit = 'b668388448da2341e9e0b00cd6d7aa3f4be252bb';
export async function comparePolishPerformance(browser, origin, output, env) {
  const baseline = mkdtempSync(join(tmpdir(), 'naql365-polish-baseline-'));
  const oldOrigin = 'http://127.0.0.1:3001';
  const oldEnv = { ...env, APP_URL: oldOrigin, NAQL365_CATALOG_DIAGNOSTICS: '0' };
  let server;
  execFileSync('git', ['worktree', 'add', '--detach', baseline, baselineCommit], {
    stdio: 'ignore',
  });
  try {
    console.log('POLISH_BENCHMARK baseline dependencies');
    execFileSync('npm', ['ci', '--no-audit'], { cwd: baseline, stdio: 'ignore', timeout: 180000 });
    console.log('POLISH_BENCHMARK baseline build');
    execFileSync(process.execPath, ['scripts/guarded-next.mjs', 'build', '--webpack'], {
      cwd: baseline,
      env: oldEnv,
      stdio: 'ignore',
      timeout: 240000,
    });
    console.log('POLISH_BENCHMARK baseline startup');
    server = await startBrowserServer(oldEnv, 3001, undefined, undefined, baseline);
    console.log('POLISH_BENCHMARK paired browser samples');
    const samples = [];
    for (const [locale, width] of [
      ['ar', 390],
      ['en', 1440],
    ]) {
      for (let pass = 0; pass < 4; pass++) {
        for (const [variant, base] of pass % 2
          ? [
              ['after', origin],
              ['before', oldOrigin],
            ]
          : [
              ['before', oldOrigin],
              ['after', origin],
            ]) {
          const context = await browser.newContext({
            viewport: { width, height: 900 },
            colorScheme: 'light',
          });
          try {
            const page = await context.newPage();
            const cdp = await context.newCDPSession(page);
            await cdp.send('Network.enable');
            await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
            await cdp.send('Network.emulateNetworkConditions', {
              offline: false,
              latency: 100,
              downloadThroughput: 200000,
              uploadThroughput: 100000,
            });
            await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
            await page.addInitScript(() => {
              const measurements = { lcp: 0, cls: 0, footerShift: 0 };
              window.naqlMeasurements = measurements;
              new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) measurements.lcp = entry.startTime;
              }).observe({ type: 'largest-contentful-paint', buffered: true });
              new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                  if (entry.hadRecentInput) continue;
                  measurements.cls += entry.value;
                  if (
                    entry.sources.some(
                      ({ node }) => node instanceof Element && node.closest('.launch-footer'),
                    )
                  )
                    measurements.footerShift += entry.value;
                }
              }).observe({ type: 'layout-shift', buffered: true });
            });
            await page.goto(base + '/' + locale, { waitUntil: 'networkidle' });
            await expect(page.locator('.store-product')).toHaveCount(6);
            await page.evaluate(() => document.fonts.ready);
            const result = await page.evaluate(() => ({
              ...window.naqlMeasurements,
              bytes: [
                ...performance.getEntriesByType('navigation'),
                ...performance.getEntriesByType('resource'),
              ].reduce((sum, entry) => sum + entry.transferSize, 0),
              firstProductY: Math.round(
                document.querySelector('.store-product').getBoundingClientRect().top,
              ),
              firstAddY: Math.round(
                document.querySelector('.store-product button').getBoundingClientRect().bottom,
              ),
            }));
            if (pass === 0) {
              await page.screenshot({
                path: join(output, variant + '-' + locale + '-' + width + '-comparison.png'),
                fullPage: true,
              });
            } else {
              samples.push({ locale, width, variant, ...result });
            }
          } finally {
            await context.close();
          }
        }
      }
    }
    const mobileShifts = samples
      .filter(({ width, variant }) => width === 390 && variant === 'after')
      .map(({ cls }) => cls)
      .sort((a, b) => a - b);
    writeFileSync(
      join(output, 'polish-performance.json'),
      JSON.stringify(
        {
          baselineCommit,
          networkKBps: 200,
          latencyMs: 100,
          cpuThrottle: 4,
          samples,
        },
        null,
        2,
      ),
    );
    expect(mobileShifts).toHaveLength(3);
    expect(mobileShifts[1], 'Median cold mobile layout shift').toBeLessThanOrEqual(0.1);
  } finally {
    await stopBrowserServer(server, 3001);
    execFileSync('git', ['worktree', 'remove', '--force', baseline], { stdio: 'ignore' });
  }
}

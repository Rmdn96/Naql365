// Opt-in, local-only comparison against the unchanged approved Design Lab source.
// Authentication remains in browser memory; artifacts contain synthetic UI and bounded metrics.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect } from '@playwright/test';

export async function captureLovableComparisons({
  phase,
  page,
  finance,
  output,
  productSlug,
  orderId,
}) {
  const reference = process.env.NAQL365_LOVABLE_REFERENCE_ORIGIN;
  const integration = new URL(page.url()).origin;
  if (!reference) return;
  if (
    reference !== 'http://127.0.0.1:4173' ||
    !['http://127.0.0.1:3000', 'http://127.0.0.1:3017'].includes(integration)
  )
    throw Error('Visual comparison requires the approved loopback origins');
  const directory = output + '/lovable-pairs';
  mkdirSync(directory, { recursive: true });
  const manifestPath = directory + '/manifest.json';
  const entries = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, 'utf8')).entries
    : [];
  const save = () =>
    writeFileSync(
      manifestPath,
      JSON.stringify(
        {
          source: '2997c92bb5b00dfbf15ae0d1ccdb289d47c4d891',
          sourceUnmodified: true,
          systemScheme: 'light',
          entries,
          differences: [
            'Reference uses its original unapproved illustrative catalog; application uses only authorized local synthetic catalog and normalized test images.',
            'Reference prices and shipping are approval placeholders; application uses approved synthetic contract values and extra authority fields.',
            'Reference customer/order records and timeline are fictional; application reads actual run-owned rows and immutable events.',
            'Reference admin commands are disabled presentation slots; application uses permission-scoped functional editors within the original Store shell.',
            'Application preserves canonical Staff authentication/workspace chrome and sensitive-action controls.',
            'Owner approved the shared primary-button dark-theme contrast correction; the original source is retained unchanged.',
          ],
        },
        null,
        2,
      ),
    );
  const scenarios =
    phase === 'cart'
      ? [
          { name: 'homepage', view: 'home', path: '', selector: '.cm-hero' },
          { name: 'catalog', view: 'catalog', path: '/store', selector: '.cm-products' },
          {
            name: 'product',
            view: 'product',
            path: '/store/products/' + productSlug,
            selector: '.cm-product-detail',
            product: 'lab-box',
          },
          { name: 'drawer', view: 'home', path: '', selector: '.cm-drawer', drawer: true },
          { name: 'checkout', view: 'checkout', path: '/store/checkout', selector: '.cm-checkout' },
        ]
      : [
          { name: 'dashboard', view: 'portal', path: '/account', selector: '.cm-portal-nav' },
          { name: 'orders', view: 'orders', path: '/store/orders', selector: '.cm-records' },
          {
            name: 'order-detail',
            view: 'orders',
            path: '/store/orders/' + orderId,
            selector: '.cm-order-detail',
            detail: true,
          },
          {
            name: 'staff-catalog',
            path: '/portal/store/catalog?kind=products',
            selector: '.st-admin-shell',
            staff: true,
          },
        ];
  const requested = process.env.NAQL365_LOVABLE_VISUAL_SCENARIOS?.split(',');
  if (
    requested?.some(
      (name) =>
        ![
          'homepage',
          'catalog',
          'product',
          'drawer',
          'checkout',
          'dashboard',
          'orders',
          'order-detail',
          'staff-catalog',
        ].includes(name),
    )
  )
    throw Error('Unknown local visual comparison scenario');
  const selected = requested
    ? scenarios.filter((scenario) => requested.includes(scenario.name))
    : scenarios;
  const referenceContext = await page.context().browser().newContext({ colorScheme: 'light' });
  const referencePage = await referenceContext.newPage();
  try {
    for (const scenario of selected)
      for (const locale of ['ar', 'en'])
        for (const theme of ['light', 'dark', 'system']) {
          const integrated = scenario.staff ? finance : page;
          await integrated.emulateMedia({ colorScheme: 'light' });
          await integrated.context().addCookies([
            {
              name: 'naql365_theme',
              value: theme,
              url: integration,
              sameSite: 'Lax',
            },
          ]);
          await referenceContext.addInitScript(
            ({ theme }) => {
              localStorage.setItem('naql365-theme', theme);
              // Reference-only visual state. This never reaches the canonical app/backend.
              sessionStorage.setItem(
                'naql365-demo-cart',
                JSON.stringify({ lines: [{ productId: 'lab-box', quantity: 1 }], rehearsal: true }),
              );
            },
            { theme },
          );
          const referenceUrl = scenario.staff
            ? `${reference}/store-admin-preview?locale=${locale}&market=EG`
            : `${reference}/?locale=${locale}&market=EG&view=${scenario.view}&product=${scenario.product ?? ''}`;
          await referencePage.goto(referenceUrl);
          if (!scenario.staff)
            await expect(referencePage.locator('.cm-cart-trigger .cm-badge')).toHaveText('1');
          if (scenario.detail) {
            await referencePage.locator('.cm-records article a').first().click();
            await referencePage.waitForURL(/view=orderDetail/);
          }
          await integrated.goto(integration + '/' + locale + scenario.path);
          if (scenario.drawer) {
            await expect(integrated.locator('.commerce-cart-badge')).toHaveText('1');
            await integrated.locator('.cm-cart-trigger').click();
            await referencePage.locator('.cm-cart-trigger').click();
          }
          await expect(referencePage.locator(scenario.selector).first()).toBeVisible();
          await expect(integrated.locator(scenario.selector).first()).toBeVisible();
          await expect(referencePage.locator('html')).toHaveAttribute('data-naql-theme', theme);
          await expect(integrated.locator('html')).toHaveAttribute('data-theme', theme);
          for (const width of [1440, 1280, 768, 390, 360]) {
            const entry = { scenario: scenario.name, locale, theme, width };
            for (const [kind, observed] of [
              ['reference', referencePage],
              ['integration', integrated],
            ]) {
              await observed.setViewportSize({ width, height: 900 });
              await observed.evaluate(() => document.fonts.ready);
              await observed.waitForFunction(() =>
                [...document.images].every((image) => {
                  const r = image.getBoundingClientRect();
                  return (
                    r.bottom < 0 ||
                    r.top > innerHeight ||
                    r.width === 0 ||
                    (image.complete && image.naturalWidth > 0)
                  );
                }),
              );
              const file = `${scenario.name}-${locale}-${theme}-${width}-${kind}.png`;
              await observed.screenshot({
                path: directory + '/' + file,
                fullPage: true,
                animations: 'disabled',
              });
              entry[kind] = {
                file,
                sha256: createHash('sha256')
                  .update(readFileSync(directory + '/' + file))
                  .digest('hex'),
                ...(await observed.evaluate((selector) => {
                  const element = document.querySelector(selector),
                    r = element.getBoundingClientRect(),
                    s = getComputedStyle(element);
                  const metric = (node) => {
                    if (!node) return null;
                    const r = node.getBoundingClientRect(),
                      s = getComputedStyle(node);
                    return {
                      x: r.x,
                      y: r.y,
                      width: r.width,
                      height: r.height,
                      fontSize: s.fontSize,
                      fontFamily: s.fontFamily,
                      gap: s.gap,
                      padding: s.padding,
                    };
                  };
                  return {
                    overflow: document.documentElement.scrollWidth > innerWidth + 1,
                    component: {
                      x: r.x,
                      y: r.y,
                      width: r.width,
                      height: r.height,
                      fontSize: s.fontSize,
                      fontFamily: s.fontFamily,
                      gap: s.gap,
                    },
                    header: metric(document.querySelector('.cm-header')),
                    hero: metric(document.querySelector('.cm-hero')),
                    title: metric(
                      document.querySelector('.cm-section-heading h1,.cm-section-heading h2'),
                    ),
                    cards: document.querySelectorAll('.cm-product').length,
                  };
                }, scenario.selector)),
              };
            }
            entries.push(entry);
            save();
            if (entry.integration.overflow) throw Error('Integrated visual comparison overflow');
          }
          if (scenario.drawer) {
            await integrated.keyboard.press('Escape');
            await referencePage.keyboard.press('Escape');
          }
          console.log('VISUAL_PAIR_GROUP ' + scenario.name + ' ' + locale + ' ' + theme);
        }
  } finally {
    save();
    await referenceContext.close();
  }
}

// Test runner only: exact protected Staging, normal password sessions, run-owned tenant.
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { chromium, expect as baseExpect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createClient } from '@supabase/supabase-js';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { parseEnv } from 'node:util';
import { acceptanceTarget, protectionHeaders } from './target.mjs';
import { stagingProject, supabase } from './supabase.mjs';
import { acquireHostedRun } from './exclusive-run.mjs';
import { visualFixtures } from './staff-visual-fixtures.mjs';
import { operationsDictionary } from '../../src/i18n/operations.ts';
import { matrixStore, families, locales, presentations, matrixId } from './wave4-staff-matrix.mjs';
if (process.env.ACCEPTANCE_OIDC_ENV_FILE)
  process.env.VERCEL_OIDC_TOKEN = parseEnv(
    readFileSync(process.env.ACCEPTANCE_OIDC_ENV_FILE, 'utf8'),
  ).VERCEL_OIDC_TOKEN;
delete process.env.SUPABASE_ACCESS_TOKEN;
const applicationSha = process.env.WAVE4_APPLICATION_SHA;
if (!/^[a-f0-9]{40}$/.test(applicationSha ?? '')) throw Error('EXACT_APPLICATION_SHA_REQUIRED');
const checkStop = () => {
  if (existsSync('supabase/.temp/wave4-stop')) throw Error('RUN_STOP_REQUESTED');
};
checkStop();
const expect = baseExpect.configure({ timeout: 20000 });
const batch = process.argv[2];
if (!['sales-support', 'operations', 'finance', 'loading', 'empty', 'all'].includes(batch))
  throw Error('EXACT_VISUAL_BATCH_REQUIRED');
const store = matrixStore(applicationSha),
  { origin } = acceptanceTarget();
const batches = batch === 'all' ? ['sales-support', 'operations', 'finance', 'loading'] : [batch];
const needsExecution =
  batches.includes('operations') &&
  families.some(
    (f) =>
      f.batch === 'operations' &&
      locales.some((locale) =>
        presentations(f).some((view) => !store.has(matrixId(f, locale, view))),
      ),
  );
const priorPath = 'docs/reports/evidence/stage3-staff-shell/index.json',
  prior = JSON.parse(readFileSync(priorPath, 'utf8'));
if (prior.applicationSha !== '1b1e02fc6c316950d53d70e671faeeca82be004e' || prior.rows.length !== 60)
  throw Error('ACCEPTED_PRIOR_INDEX_MISMATCH');
for (const row of prior.rows) {
  const path = join('docs/reports/evidence/stage3-staff-shell', basename(row.file ?? row.filename));
  if (createHash('sha256').update(readFileSync(path)).digest('hex') !== row.sha256)
    throw Error('ACCEPTED_PRIOR_HASH_MISMATCH');
}
store.index.priorEvidence = {
  index: priorPath,
  count: 60,
  sha256: createHash('sha256').update(readFileSync(priorPath)).digest('hex'),
  hashesVerified: true,
  applicationSha: prior.applicationSha,
  applicability:
    'Historical Stage 3 evidence retained and hash-verified. Wave 4 rendering has changed; these captures are not reused as Wave 4 acceptance.',
};
store.save();
console.log('Existing 60 accepted screenshots hash verification PASS');
if (origin !== 'https://naql365-staging-ui-v2-naql365.vercel.app')
  throw Error('CANONICAL_UI_V2_REQUIRED');
const deployment = JSON.parse(readFileSync('supabase/.temp/wave4-deployment-proof.json', 'utf8'));
if (
  deployment.applicationSha !== applicationSha ||
  deployment.origin !== origin ||
  deployment.state !== 'READY' ||
  deployment.target !== 'preview' ||
  deployment.protection !== 'ENABLED' ||
  !/^dpl_[A-Za-z0-9]+$/.test(deployment.id)
)
  throw Error('DEPLOYMENT_PROOF_MISMATCH');
store.index.deployment = deployment;
store.save();
const headers = protectionHeaders();
if (
  (
    await fetch(origin + '/en/login', {
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(20000),
    })
  ).status !== 200
)
  throw Error('PROTECTED_PREFLIGHT_FAILED');
const anonymous = await fetch(origin + '/en/login', {
  redirect: 'manual',
  signal: AbortSignal.timeout(20000),
});
if (![302, 401, 403].includes(anonymous.status)) throw Error('PREVIEW_PROTECTION_NOT_VERIFIED');
const ref = stagingProject(),
  release = acquireHostedRun();
const keys = JSON.parse(
  supabase(['projects', 'api-keys', '--project-ref', ref, '--reveal', '--output', 'json']),
);
const admin = createClient(
  'https://' + ref + '.supabase.co',
  keys.find((k) => k.type === 'secret').api_key,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const org = randomUUID(),
  identities = {},
  ledger = [],
  run = Date.now(),
  ledgerPath = `supabase/.temp/wave4-staff-visual-${run}.json`;
const record = (kind, data) => {
  ledger.push({ kind, ...data });
  writeFileSync(ledgerPath, JSON.stringify({ run, org, ledger }, null, 2));
};
record('organization', { id: org });
record('run-meta', { applicationSha, evidenceDirectory: store.directory });
release.track('organization', org);
let browser,
  fixture,
  baseline,
  checkpoint = 'setup',
  cleanupResult;
const roleModules = {
  SUPER_ADMIN: ['quotes', 'operations', 'finance', 'finance/banks', 'support'],
  SALES: ['quotes'],
  OPERATIONS: ['operations'],
  DISPATCHER: ['operations'],
  FINANCE: ['finance'],
  CUSTOMER_SERVICE: ['support'],
};
const bank = [];
const marketChecks = [];
// Browser-only presentation control renders the existing committed component verbatim.
// It is not an application endpoint, authorization bypass, or network-loading claim.
const loadingSourcePath = 'src/app/[locale]/(portal)/portal/loading.tsx';
const loadingSource = readFileSync(loadingSourcePath, 'utf8');
const loadingExports = {};
const loadingCode = ts.transpileModule(loadingSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
}).outputText;
new Function('React', 'exports', loadingCode)(React, loadingExports);
const loadingMarkup = renderToStaticMarkup(React.createElement(loadingExports.default));
const loadingSourceSha256 = createHash('sha256').update(loadingSource).digest('hex');
try {
  for (const role of [...Object.keys(roleModules), 'CUSTOMER']) {
    const email = `visual-${randomUUID()}@example.invalid`,
      password = randomBytes(24).toString('base64url');
    const r = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (r.error || !r.data.user) throw Error('VISUAL_IDENTITY_FAILED');
    identities[role] = { id: r.data.user.id, email, password };
    record('auth', { id: r.data.user.id });
    release.track('auth', r.data.user.id);
  }
  fixture = visualFixtures(ref, org, identities, record);
  baseline = fixture.snapshot();
  checkpoint = 'tenant-catalogue';
  fixture.setup(batch !== 'empty');
  // Exact effective permission readback in the same single organization used by loaders.
  for (const user of Object.values(identities))
    user.permissions = fixture
      .sql(
        `select p.code from public.permissions p join public.role_permissions rp on rp.permission_id=p.id join public.user_roles ur on ur.role_id=rp.role_id where ur.organization_id='${org}' and ur.profile_id='${user.id}' order by p.code`,
      )
      .map((r) => r.code);
  for (const role of Object.keys(roleModules)) {
    const p = new Set(identities[role].permissions);
    roleModules[role] = [
      ...(p.has('pricing.calculate') ? ['quotes'] : []),
      ...(p.has('operations.manage') ? ['operations'] : []),
      ...(p.has('finance.read') ? ['finance'] : []),
      ...(p.has('finance.accounts.manage') ? ['finance/banks'] : []),
      ...(p.has('support.read') && p.has('requests.read') ? ['support'] : []),
    ];
  }
  const prohibited = [
    'pricing.calculate',
    'quotes.manage',
    'operations.manage',
    'dispatch.manage',
    'finance.verify',
    'guest.links.manage',
  ];
  if (prohibited.some((p) => identities.CUSTOMER_SERVICE.permissions.includes(p)))
    throw Error('SUPPORT_AUTHORITY_BROADENED');
  // Synthetic customer facts are inserted only in this ledger-owned tenant.
  const requests = {};
  let quote, order, job, trip, driver, vehicle, trips;
  if (batch === 'loading') {
    // Loading captures need only valid authorized route targets, not a new full journey suite.
    requests[30] = fixture.request('visual-loading', 30);
    const q = fixture.draft(requests[30]);
    fixture.send(q);
    order = { review: fixture.respond(q, 'accept') };
    fixture.pay(order.review, 'choose', { method: 'CASH' });
    job = fixture.op('create_job', order.review);
    trip = fixture.op('create_trip', job);
  } else if (batch !== 'empty') {
    checkpoint = 'request-facts';
    for (let n = 1; n <= 34; n++) requests[n] = fixture.request('visual-' + n, n);
    quote = {
      draft: fixture.draft(requests[1]),
      sent: fixture.draft(requests[2]),
      rejected: fixture.draft(requests[3]),
      accepted: fixture.draft(requests[4]),
    };
    checkpoint = 'commercial-transitions';
    for (const id of [quote.sent, quote.rejected, quote.accepted]) fixture.send(id);
    const previous = fixture.draft(requests[29]);
    fixture.send(previous);
    fixture.draft(requests[29], 22345);
    fixture.respond(quote.rejected, 'reject');
    const accepted = fixture.respond(quote.accepted, 'accept');
    order = { planning: accepted };
    let count = 5;
    const newOrder = (name) => {
      const id = fixture.draft(requests[count++]);
      fixture.send(id);
      order[name] = fixture.respond(id, 'accept');
      return order[name];
    };
    for (const name of [
      'cash',
      'awaiting',
      'review',
      'rejected',
      'resubmitted',
      'confirmed',
      'active',
      'complete',
      'cashEn',
    ])
      newOrder(name);
    checkpoint = 'payment-transitions';
    fixture.pay(order.planning, 'choose', { method: 'CASH' });
    fixture.pay(order.cash, 'choose', { method: 'CASH' });
    fixture.pay(order.cashEn, 'choose', { method: 'CASH' });
    for (const name of ['awaiting', 'review', 'rejected', 'resubmitted', 'confirmed'])
      fixture.pay(order[name], 'choose', { method: 'BANK_TRANSFER' });
    for (const name of ['review', 'rejected', 'resubmitted', 'confirmed']) {
      const attempt = await fixture.proof(order[name], admin);
      if (['rejected', 'resubmitted'].includes(name))
        fixture.pay(
          order[name],
          'reject_transfer',
          { attemptId: attempt, reason: 'TEST clearer proof required', note: 'Synthetic review' },
          'FINANCE',
        );
      if (name === 'resubmitted') await fixture.proof(order[name], admin);
      if (name === 'confirmed')
        fixture.pay(
          order[name],
          'confirm_transfer',
          {
            attemptId: attempt,
            amountMinor: 14197,
            currency: 'SAR',
            reference: 'TEST-RECEIPT',
            note: 'TEST',
          },
          'FINANCE',
        );
    }
    job = fixture.op('create_job', order.planning);
    trip = fixture.op('create_trip', job);
    driver = fixture.op('create_driver', org, {
      marketId: fixture.sa,
      type: 'EXTERNAL',
      name: 'سائق اختبار — Synthetic operator',
    });
    vehicle = fixture.op('create_vehicle', org, {
      marketId: fixture.sa,
      type: 'Truck',
      identifier: 'TEST-VISUAL-01',
    });
    const plan = {
      plannedStart: new Date(Date.now() + 86400000).toISOString(),
      plannedEnd: new Date(Date.now() + 90000000).toISOString(),
      stops: [
        {
          cityId: fixture.city,
          kind: 'PICKUP',
          address: 'عنوان استلام اصطناعي طويل لاختبار الالتفاف',
          pickups: [],
        },
        {
          cityId: fixture.city,
          kind: 'DELIVERY',
          address: 'عنوان تسليم اصطناعي طويل لاختبار الالتفاف',
          pickups: [0],
        },
      ],
    };
    fixture.op('plan', trip, plan);
    trips = { planned: trip };
    // Locale-specific success fixtures preserve forward-only assignment lifecycle.
    if (batches.includes('operations')) {
      const enOrder = newOrder('assignmentEn');
      fixture.pay(enOrder, 'choose', { method: 'CASH' });
      const enJob = fixture.op('create_job', enOrder);
      trips.assignmentEn = fixture.op('create_trip', enJob);
      fixture.op('plan', trips.assignmentEn, plan);
      trips.assignmentDriverEn = fixture.op('create_driver', org, {
        marketId: fixture.sa,
        type: 'EXTERNAL',
        name: 'TEST English assignment driver',
      });
      trips.assignmentVehicleEn = fixture.op('create_vehicle', org, {
        marketId: fixture.sa,
        type: 'Truck',
        identifier: 'TEST-VISUAL-EN',
      });
    }
    checkpoint = 'trip-transitions';
    for (const name of ['active', 'complete'])
      fixture.pay(order[name], 'choose', { method: 'CASH' });
    if (needsExecution) {
      for (const name of ['active', 'complete']) {
        const j = fixture.op('create_job', order[name]),
          t = fixture.op('create_trip', j);
        trips[name] = t;
        const d = fixture.op('create_driver', org, {
          marketId: fixture.sa,
          type: 'EXTERNAL',
          name: 'TEST ' + name,
        });
        const v = fixture.op('create_vehicle', org, {
          marketId: fixture.sa,
          type: 'Truck',
          identifier: 'TEST-' + name,
        });
        fixture.op('plan', t, plan);
        fixture.op('assign', t, { driverId: d, vehicleId: v });
        fixture.op('ready', t);
        fixture.op('dispatch', t);
        if (name === 'complete') {
          const stops = fixture.sql(
            `select id from public.trip_stops where trip_id='${t}' order by position`,
          );
          for (let n = 0; n < stops.length; n++) {
            if (n) fixture.op('depart', t, { stopId: stops[n].id });
            for (const a of ['arrive', 'start_service', 'complete_stop'])
              fixture.op(a, t, { stopId: stops[n].id });
          }
          const buffer = Buffer.from(
              'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/wAAAABJRU5ErkJggg==',
              'base64',
            ),
            file = randomUUID();
          const r = fixture.command(
            'OPERATIONS',
            `public.trip_pod_command(p_trip_id=>'${t}',p_file_id=>'${file}',p_action=>'reserve',p_recipient=>'TEST recipient',p_mime=>'image/png',p_size=>${buffer.length},p_notes=>'TEST')`,
          );
          record('storage', { bucket: 'pod-files', path: r.path });
          if (
            (
              await admin.storage
                .from('pod-files')
                .upload(r.path, buffer, { contentType: 'image/png' })
            ).error
          )
            throw Error('POD_UPLOAD_FAILED');
          fixture.command('OPERATIONS', `public.trip_pod_command('${t}','${file}','finalize')`);
          fixture.op('complete_trip', t);
        }
      }
      // An issue is a valid synthetic business record, not fabricated dashboard progress.
      const issue = randomUUID(),
        stop = fixture.sql(
          `select id from public.trip_stops where trip_id='${trips.active}' order by position limit 1`,
        )[0].id;
      record('issue', { id: issue });
      fixture.sql(
        `insert into public.issues(id,organization_id,market_id,request_id,trip_id,stop_id,category,reason,status,actor_id,mutation_id) values('${issue}','${org}','${fixture.sa}',(select request_id from public.orders where id='${order.active}'),'${trips.active}','${stop}','OTHER','بلاغ اصطناعي لاختبار وضوح التعامل مع المشكلة','OPEN','${identities.OPERATIONS.id}','${randomUUID()}')`,
      );
    }
  }
  browser = await chromium.launch();
  async function open(role, locale) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } }),
      page = await context.newPage();
    await context.route('**/*', (route) =>
      route.continue({
        headers: {
          ...route.request().headers(),
          ...(new URL(route.request().url()).origin === origin ? headers : {}),
        },
      }),
    );
    await page.goto(origin + '/' + locale + '/login');
    await page.locator('#email').fill(identities[role].email);
    await page.locator('#password').fill(identities[role].password);
    await page.locator('.auth-form button:not([type=button])').click();
    await expect(page).toHaveURL(new RegExp('/' + locale + '/portal$'));
    await expect(page.locator('.staff-app')).toBeVisible();
    const nav = page.locator('.staff-sidebar nav');
    for (const workspaceModule of ['quotes', 'operations', 'finance', 'finance/banks', 'support'])
      await expect(nav.locator(`a[href="/${locale}/portal/${workspaceModule}"]`)).toHaveCount(
        roleModules[role].includes(workspaceModule) ? 1 : 0,
      );
    bank.push({
      role,
      locale,
      permissions: identities[role].permissions,
      modules: roleModules[role],
      result: 'PASS',
    });
    return { context, page };
  }
  async function capture(page, family, locale, mode = 'REAL_HOSTED', extra = {}) {
    for (const view of presentations(family)) {
      checkStop();
      const { width, theme, system } = view;
      const id = matrixId(family, locale, view);
      if (store.has(id)) continue;
      checkpoint = id;
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: system });
      const themeControl = page.locator('.staff-topbar .theme-control select');
      await expect(themeControl).toBeEnabled();
      await themeControl.selectOption(theme);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await page.waitForTimeout(120);
      await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      expect(await page.locator('input[type=password]').count()).toBe(0);
      const text = await page.locator('body').innerText();
      if (
        /g1_[a-f0-9]{64}|eyJ[a-zA-Z0-9_-]{30,}|https:\/\/[^\s]*[?&](?:token|signature)=|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/.test(
          text,
        )
      )
        throw Error('UNSAFE_OR_INTERNAL_CAPTURE_TEXT');
      const clipped = await page.evaluate(
        () =>
          Array.from(document.querySelectorAll('button,a.button')).filter(
            (e) =>
              e.getClientRects().length &&
              getComputedStyle(e).overflow === 'hidden' &&
              e.scrollWidth > e.clientWidth + 2,
          ).length,
      );
      expect(clipped).toBe(0);
      const layout = await page.evaluate(() => {
        const root = document.querySelector('dialog[open]') ?? document;
        const actions = Array.from(root.querySelectorAll('button,a.button')).filter((e) => {
          const r = e.getBoundingClientRect(),
            s = getComputedStyle(e);
          return r.width > 0 && r.height > 0 && s.visibility !== 'hidden';
        });
        let overlapping = 0;
        for (let a = 0; a < actions.length; a++)
          for (let b = a + 1; b < actions.length; b++) {
            const x = actions[a].getBoundingClientRect(),
              y = actions[b].getBoundingClientRect();
            if (
              Math.min(x.right, y.right) - Math.max(x.left, y.left) > 2 &&
              Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top) > 2
            )
              overlapping++;
          }
        const unlabelled = Array.from(
          root.querySelectorAll('input:not([type=hidden]),select,textarea'),
        ).filter(
          (e) =>
            e.getClientRects().length &&
            !e.getAttribute('aria-label') &&
            !e.getAttribute('aria-labelledby') &&
            !e.labels?.length,
        ).length;
        return { overlapping, unlabelled };
      });
      if (layout.overlapping || layout.unlabelled) {
        record('layout-diagnostic', { checkpoint, ...layout });
        await page.screenshot({
          path: join(store.directory, `failed-${checkpoint}.png`),
          fullPage: true,
        });
      }
      expect(layout).toEqual({ overlapping: 0, unlabelled: 0 });
      const focusRoot = (await page.locator('dialog[open]').count())
        ? page.locator('dialog[open]')
        : page.locator('.staff-workspace-content');
      let first = focusRoot
        .locator('button:not([disabled]),a,input:not([disabled])')
        .filter({ visible: true })
        .first();
      if (!(await first.count()))
        first = page.locator('.staff-app a').filter({ visible: true }).first();
      if (await first.count()) {
        await page.keyboard.press('Tab');
        await first.focus();
        await expect(first).toBeFocused();
        const focus = await first.evaluate((e) => {
          const s = getComputedStyle(e);
          return s.outlineStyle !== 'none' || s.boxShadow !== 'none';
        });
        expect(focus).toBe(true);
        await page.keyboard.press('Tab');
      }
      if (width === 360 || width === 1440) {
        const violations = (
          await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
        ).violations;
        if (violations.length) {
          store.index.failures.push({
            id,
            type: 'axe',
            rules: violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
          });
          store.save();
          throw Error('VISUAL_AXE_FAILURE');
        }
      }
      if (
        family.state !== 'loading' &&
        width < 1024 &&
        (await page.locator('.staff-drawer-trigger').isVisible()) &&
        !(await page.locator('dialog[open]').count())
      ) {
        const trigger = page.locator('.staff-drawer-trigger');
        await trigger.focus();
        await page.keyboard.press('Enter');
        await expect(page.locator('.staff-drawer')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(trigger).toBeFocused();
      }
      await page.evaluate(() => scrollTo(0, 0));
      if (family.state === 'loading')
        await expect(
          page.getByText('جارٍ تحميل مساحة العمل · Loading workspace…', { exact: true }),
        ).toBeVisible();
      const filename = id + '.png';
      await page.screenshot({ path: join(store.directory, filename), fullPage: true });
      store.add({
        id,
        family: family.id,
        route: family.route,
        role: family.role,
        effectivePermissions: identities[family.role].permissions,
        locale,
        width,
        theme,
        system,
        country: await page.locator('#staff-market').inputValue(),
        state: family.state,
        mode,
        applicationSha,
        capturedAt: new Date().toISOString(),
        result: 'PASS',
        filename,
        sha256: createHash('sha256')
          .update(readFileSync(join(store.directory, filename)))
          .digest('hex'),
        fixture: 'run-' + run,
        checks: {
          overflow: 'PASS',
          direction: 'PASS',
          clippedActions: 'PASS',
          overlap: 'PASS',
          labels: 'PASS',
          focus: 'PASS',
          axeSmoke:
            width === 360 || width === 1440 ? 'PASS' : 'Same state markup checked at 360 and 1440',
        },
        ...extra,
      });
    }
  }
  async function feedback(page, family, locale, url, button, setup = async () => {}) {
    await setup();
    const selector = page
      .getByRole('button', { name: button, exact: true })
      .filter({ visible: true })
      .first();
    if (family.state.includes('busy')) {
      let resume;
      const held = new Promise((r) => (resume = r));
      await page.route(origin + url, async (route) => {
        await held;
        await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
      });
      await selector.click();
      await expect(selector).toBeDisabled();
      await capture(page, family, locale, 'CONTROLLED_PRESENTATION', {
        control: 'Owned browser holds command response; no mutation forwarded',
      });
      resume();
      await expect(selector).toBeEnabled();
      await page.unroute(origin + url);
    } else {
      await page.route(origin + url, (route) =>
        route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }),
      );
      await selector.click();
      await expect(
        page.locator('.staff-workspace-content [role=alert]').filter({ visible: true }).first(),
      ).toBeVisible();
      await capture(page, family, locale, 'CONTROLLED_PRESENTATION', {
        control: 'Owned browser returns bounded 503 without changing Staging infrastructure',
      });
      await page.unroute(origin + url);
    }
  }
  for (const activeBatch of batches)
    for (const role of [
      ...new Set(families.filter((f) => f.batch === activeBatch).map((f) => f.role)),
    ])
      for (const locale of locales) {
        const { page, context } = await open(role, locale);
        const root = '/' + locale + '/portal';
        const go = async (path) => {
          await page.goto(origin + root + path);
          await expect(page.locator('.staff-app')).toBeVisible();
          await expect(page.locator('.staff-workspace-content h1')).toBeVisible();
        };
        try {
          if (activeBatch === 'empty') {
            await go('');
            for (const country of ['EG', 'SA']) {
              const changed = page.waitForResponse(
                (r) =>
                  new URL(r.url()).pathname === '/api/public/market' &&
                  r.request().method() === 'POST',
              );
              await page.locator('#staff-market').selectOption(country);
              expect((await changed).status()).toBe(200);
              await expect(page.locator('#staff-market')).toHaveValue(country);
              await page.reload();
              await expect(page.locator('#staff-market')).toHaveValue(country);
              for (const theme of ['light', 'dark', 'system']) {
                const width = theme === 'light' ? 1440 : 360;
                await page.setViewportSize({ width, height: 900 });
                await page.emulateMedia({ colorScheme: theme === 'light' ? 'light' : 'dark' });
                await page.locator('.staff-topbar .theme-control select').selectOption(theme);
                await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
                await expect(page.locator('html')).toHaveAttribute(
                  'dir',
                  locale === 'ar' ? 'rtl' : 'ltr',
                );
                expect(
                  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
                ).toBe(true);
                await expect(page.locator('.staff-workspace-content h1')).toBeVisible();
                const row = {
                  role,
                  locale,
                  country,
                  theme,
                  width,
                  route: '/portal',
                  applicationSha,
                  fixture: 'run-' + run,
                  result: 'PASS',
                  checks: [
                    'market POST 200',
                    'refresh persistence',
                    'theme',
                    'direction',
                    'overflow',
                  ],
                  capturedAt: new Date().toISOString(),
                };
                if (role === 'SUPER_ADMIN') {
                  await expect(page.locator('input[type=password]')).toHaveCount(0);
                  const filename =
                    'market-' + country + '-' + locale + '-' + width + '-' + theme + '.png';
                  await page.screenshot({ path: join(store.directory, filename), fullPage: true });
                  row.filename = filename;
                  row.sha256 = createHash('sha256')
                    .update(readFileSync(join(store.directory, filename)))
                    .digest('hex');
                }
                marketChecks.push(row);
              }
            }
          }
          for (const f of families.filter((f) => f.batch === activeBatch && f.role === role)) {
            checkStop();
            if (presentations(f).every((view) => store.has(matrixId(f, locale, view)))) continue;
            checkpoint = f.id + '-' + locale;
            if (f.id.startsWith('empty-')) {
              await go(f.route.slice('/portal'.length));
              await expect(page.locator('.staff-queue li,.staff-support-card')).toHaveCount(0);
              await capture(page, f, locale);
              continue;
            }
            if (f.id.startsWith('loading-')) {
              const route = f.route
                .replace('/quotes/[id]', '/quotes/' + requests[30])
                .replace('/jobs/[id]', '/jobs/' + job)
                .replace('/trips/[id]', '/trips/' + trip)
                .replace('/finance/[id]', '/finance/' + order.review);
              const exact = origin + '/' + locale + route;
              await page.goto(exact);
              await expect(page.locator('.staff-workspace-content')).toBeVisible();
              await page.evaluate((markup) => {
                const root = document.querySelector('.staff-workspace-content');
                if (!root) throw Error('AUTHORIZED_WORKSPACE_NOT_PRESENT');
                const range = document.createRange();
                range.selectNodeContents(root);
                root.replaceChildren(range.createContextualFragment(markup));
              }, loadingMarkup);
              await capture(page, f, locale, 'CONTROLLED_PRESENTATION', {
                control:
                  'Existing shared loading component rendered verbatim inside an already authorized hosted shell; browser-only presentation simulation, not measured network loading',
                componentSource: loadingSourcePath,
                componentSourceSha256: loadingSourceSha256,
              });
              continue;
            }
            if (f.id.startsWith('shell-')) {
              await go('');
              await capture(page, f, locale);
              continue;
            }
            if (f.id.startsWith('support-')) {
              await go('/support');
              if (f.state === 'pagination') {
                await page
                  .getByRole('link', {
                    name: locale === 'ar' ? 'الطلبات الأقدم' : 'Older requests',
                    exact: true,
                  })
                  .click();
                await expect(page.locator('.staff-support-card')).toHaveCount(4);
              }
              if (f.state === 'empty') {
                await page.locator('#staff-market').selectOption('EG');
                await expect(page.locator('.staff-support-card')).toHaveCount(0);
              }
              if (f.state === 'error-retry') {
                await go('/support?before=invalid');
                await expect(
                  page.getByRole('button', {
                    name: locale === 'ar' ? 'حاول مجددًا' : 'Try again',
                    exact: true,
                  }),
                ).toBeVisible();
              }
              if (f.state === 'recovered') await go('/support');
              await capture(page, f, locale);
              if (f.state === 'empty') {
                await page.locator('#staff-market').selectOption('SA');
                await expect(page.locator('.staff-support-card').first()).toBeVisible();
              }
              continue;
            }
            if (f.id.startsWith('sales-')) {
              if (f.state === 'queue') {
                await go('/quotes');
                await capture(page, f, locale);
                continue;
              }
              const rid =
                f.state === 'draft'
                  ? requests[1]
                  : f.state === 'sent'
                    ? requests[2]
                    : f.state === 'rejected'
                      ? requests[3]
                      : f.state === 'history'
                        ? requests[29]
                        : f.state === 'accepted'
                          ? requests[4]
                          : requests[locale === 'ar' ? 30 : 31];
              await go('/quotes/' + rid);
              const label = await page
                .locator('.commercial-stack button')
                .filter({ visible: true })
                .allTextContents();
              const draftLabel = label.find((x) => /مسودة|draft/i.test(x));
              if (!draftLabel) throw Error('DRAFT_ACTION_NOT_FOUND');
              await expect(page.locator('#distance')).toBeEnabled();
              if (f.state === 'validation') {
                await page.locator('#manual-subtotal').fill('invalid');
                await page.getByRole('button', { name: draftLabel, exact: true }).click();
                await expect(page.locator('.commercial-stack [role=alert]')).toBeVisible();
              }
              if (['busy', 'error-retry'].includes(f.state)) {
                await feedback(
                  page,
                  f,
                  locale,
                  '/api/sales/quotes/manual',
                  draftLabel,
                  async () => {
                    await page.locator('#distance').fill('18.75');
                    await page.locator('#manual-subtotal').fill('123.45');
                  },
                );
                continue;
              }
              if (f.state === 'success') {
                await page.locator('#distance').fill('18.75');
                await page.locator('#manual-subtotal').fill('123.45');
                await page.getByRole('button', { name: draftLabel, exact: true }).click();
                await expect(page.locator('.staff-workspace-content')).toContainText(
                  locale === 'ar' ? 'مسودة' : 'Draft',
                );
              }
              await capture(page, f, locale);
              continue;
            }
            if (f.id.startsWith('operations-') || f.id === 'dispatcher-planned') {
              if (f.state === 'queue') {
                await go('/operations');
                await capture(page, f, locale);
                continue;
              }
              if (f.state === 'job') {
                await go('/operations/jobs/' + job);
                await capture(page, f, locale);
                continue;
              }
              const t = ['active', 'issue', 'reassignment-dialog'].includes(f.state)
                ? trips.active
                : f.state === 'completed'
                  ? trips.complete
                  : f.state === 'assignment-success' && locale === 'en'
                    ? trips.assignmentEn
                    : trip;
              await go('/operations/trips/' + t);
              if (f.state === 'reassignment-dialog') {
                await page
                  .getByRole('button', {
                    name: operationsDictionary(locale).emergency,
                    exact: true,
                  })
                  .click();
                await expect(page.getByRole('dialog')).toBeVisible();
              }
              if (f.state === 'assignment-validation') {
                await page.locator('#assign-driver').selectOption('');
                await page.locator('#assign-driver').evaluate((e) => e.reportValidity());
                await expect(page.locator('#assign-driver:invalid')).toHaveCount(1);
              }
              if (
                ['assignment-busy', 'assignment-error-retry', 'assignment-success'].includes(
                  f.state,
                )
              ) {
                await page
                  .locator('#assign-driver')
                  .selectOption(
                    f.state === 'assignment-success' && locale === 'en'
                      ? trips.assignmentDriverEn
                      : driver,
                  );
                await page
                  .locator('#assign-vehicle')
                  .selectOption(
                    f.state === 'assignment-success' && locale === 'en'
                      ? trips.assignmentVehicleEn
                      : vehicle,
                  );
                const button = await page
                  .locator('form')
                  .filter({ has: page.locator('#assign-driver') })
                  .locator('button')
                  .last()
                  .innerText();
                if (f.state !== 'assignment-success') {
                  await feedback(page, f, locale, '/api/operations', button);
                  continue;
                }
                const response = page.waitForResponse(
                  (r) =>
                    new URL(r.url()).pathname === '/api/operations' &&
                    r.request().method() === 'POST',
                );
                await page.getByRole('button', { name: button, exact: true }).click();
                expect((await response).status()).toBe(200);
                await expect
                  .poll(
                    () =>
                      fixture.sql(
                        `select status from public.trips where id='${t}' and organization_id='${org}'`,
                      )[0]?.status,
                  )
                  .toBe('ASSIGNED');
                await expect(
                  page
                    .locator('.staff-workspace-content .badge')
                    .filter({ hasText: locale === 'ar' ? 'تم التعيين' : 'Assigned' })
                    .first(),
                ).toBeVisible();
              }
              await capture(page, f, locale);
              continue;
            }
            if (f.id.startsWith('finance-')) {
              if (['queue', 'filtered-empty', 'paginated-empty'].includes(f.state)) {
                await go(
                  '/finance' +
                    (f.state === 'filtered-empty'
                      ? '?status=PENDING'
                      : f.state === 'paginated-empty'
                        ? '?offset=30'
                        : ''),
                );
                await capture(page, f, locale);
                continue;
              }
              const name = {
                'cash-due': 'cash',
                'awaiting-proof': 'awaiting',
                review: 'review',
                'disabled-reject': 'review',
                rejected: 'rejected',
                resubmitted: 'resubmitted',
                confirmed: 'confirmed',
                busy: 'cash',
                'error-retry': 'cash',
                success: 'cash',
              }[f.state];
              await go('/finance/' + order[name === 'cash' && locale === 'en' ? 'cashEn' : name]);
              if (['busy', 'error-retry'].includes(f.state)) {
                const b = page
                  .locator('.staff-workspace-content button')
                  .filter({ hasText: locale === 'ar' ? 'تأكيد تحصيل كامل' : 'Confirm full cash' })
                  .first();
                await feedback(page, f, locale, '/api/payments', await b.innerText());
                continue;
              }
              if (f.state === 'disabled-reject')
                await expect(page.locator('.staff-workspace-content form button')).toBeDisabled();
              if (f.state === 'success') {
                const b = page
                  .locator('.staff-workspace-content button')
                  .filter({ hasText: locale === 'ar' ? 'تأكيد تحصيل كامل' : 'Confirm full cash' })
                  .first();
                const response = page.waitForResponse(
                  (r) =>
                    new URL(r.url()).pathname === '/api/payments' &&
                    r.request().method() === 'POST',
                );
                await b.click();
                expect((await response).status()).toBe(200);
                await expect(
                  page.locator('.staff-workspace-content .alert--success[role=status]'),
                ).toBeVisible();
                const paidOrder = order[locale === 'en' ? 'cashEn' : 'cash'];
                expect(
                  fixture.sql(
                    `select status from public.payments where order_id='${paidOrder}' and organization_id='${org}'`,
                  )[0]?.status,
                ).toBe('PAID');
              }
              await capture(page, f, locale);
              continue;
            }
            if (f.id.startsWith('banks-')) {
              await go('/finance/banks');
              const form = page.locator('.staff-workspace-content form').first();
              const button = await form.locator('button').last().innerText();
              if (f.state === 'validation') {
                await form.locator('input[name=accountNumber]').fill('invalid value !');
                await form.locator('button').last().click();
                await expect(form.locator('[role=alert]')).toBeVisible();
              }
              if (['busy', 'error-retry'].includes(f.state)) {
                await feedback(page, f, locale, '/api/payments/banks', button);
                continue;
              }
              if (f.state === 'success') {
                const before = fixture.sql(
                  `select revision from public.bank_accounts where organization_id='${org}'`,
                )[0].revision;
                await form.locator('button').last().click();
                await expect
                  .poll(
                    () =>
                      fixture.sql(
                        `select revision from public.bank_accounts where organization_id='${org}'`,
                      )[0].revision,
                  )
                  .toBeGreaterThan(before);
                await expect(form.locator('button').last()).toBeEnabled();
              }
              await capture(page, f, locale);
            }
          }
        } finally {
          await context.close();
        }
      }
  for (const checkedBatch of batches) store.complete(checkedBatch);
  if (batch === 'empty') {
    if (marketChecks.length !== 60) throw Error('MARKET_THEME_SMOKE_INCOMPLETE');
    writeFileSync(
      join(store.directory, 'market-theme-smoke.json'),
      JSON.stringify(
        {
          applicationSha,
          result: 'PASS',
          total: marketChecks.length,
          rows: marketChecks,
          scope:
            'Supplemental role/locale/Market/theme shell checks, separate from 590 state matrix; synthetic empty tenant, no financial destination.',
        },
        null,
        2,
      ),
    );
  }
  writeFileSync(
    join(store.directory, `navigation-${batch}-${run}.json`),
    JSON.stringify(bank, null, 2),
  );
  console.log(
    JSON.stringify({
      batch,
      result: 'PASS',
      captures: store.index.pass,
      missing: store.index.missing.length,
    }),
  );
} catch (error) {
  process.exitCode = 1;
  store.index.failures.push({
    run,
    batch,
    checkpoint,
    classification:
      error.message && /^[A-Z_]+$/.test(error.message) ? error.message : 'ASSERTION_OR_RUNTIME',
    sourceLine: error.stack?.match(/verify-wave4-staff\.mjs:(\d+)/)?.[1] ?? null,
    timestamp: new Date().toISOString(),
  });
  store.save();
  console.error(
    JSON.stringify({
      batch,
      checkpoint,
      result: 'FAIL',
      errorDetails: 'withheld; inspect safe matrix metadata',
    }),
  );
} finally {
  if (browser) await browser.close();
  try {
    if (fixture) {
      cleanupResult = await fixture.cleanup(admin, ledger);
      if (fixture.snapshot() !== baseline) throw Error('BASELINE_CHANGED');
    } else for (const user of Object.values(identities)) await admin.auth.admin.deleteUser(user.id);
    const publicClient = createClient(
      'https://' + ref + '.supabase.co',
      keys.find((k) => k.type === 'publishable').api_key,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    for (const user of Object.values(identities)) {
      const retry = await publicClient.auth.signInWithPassword({
        email: user.email,
        password: user.password,
      });
      if (!retry.error || retry.error.code !== 'invalid_credentials' || retry.data.session)
        throw Error('DISPOSED_FIXTURE_CREDENTIAL_REUSE_NOT_DENIED');
    }
    record('credential-disposal', {
      result: 'PASS',
      identities: Object.keys(identities).length,
      reuse: 'DENIED',
      operatorCredentialProvisioned: false,
    });
    record('cleanup', { result: 'PASS', remaining: cleanupResult });
    console.log('Visual run-owned fixture cleanup PASS');
  } catch {
    process.exitCode = 1;
    record('cleanup', { result: 'FAIL' });
    console.error('Visual cleanup incomplete; recover exact ledger before another run');
  }
  release();
}

import { localSupabase } from './local-supabase.mjs';
import { startBrowserServer, stopBrowserServer } from './browser-server.mjs';
import { execFileSync } from 'node:child_process';
import { randomUUID, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import sharp from 'sharp';
import { z } from 'zod';
import { driverDictionary } from '../src/i18n/driver.ts';
import { operationLabel } from '../src/i18n/operations.ts';
const local = localSupabase(),
  origin = 'http://127.0.0.1:3017';
if (new URL(local.API_URL).hostname !== '127.0.0.1') throw Error('LOCAL_ONLY');
const env = {
  ...process.env,
  APP_ENV: 'local',
  APP_URL: origin,
  NEXT_PUBLIC_SUPABASE_URL: local.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.PUBLISHABLE_KEY,
  STAGING_AUTH_SMOKE_ENABLED: 'false',
};
for (const k of Object.keys(env))
  if (k.startsWith('VERCEL') || /^SUPABASE_.*(?:TOKEN|PASSWORD|SERVICE|SECRET)/.test(k))
    delete env[k];
const admin = createClient(local.API_URL, local.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  }),
  users = [],
  clients = [],
  org = randomUUID(),
  otherOrg = randomUUID();
const output = 'test-results/driver-local-' + Date.now();
mkdirSync(output, { recursive: true });
const evidence = {
  syntheticLocalOnly: true,
  checks: [],
  captures: [],
  cleanup: false,
  credentialReuseDenied: false,
  pass: false,
};
let checkpoint = 'initialization',
  server,
  browser,
  seeded = false,
  page;
const save = () => {
  writeFileSync(output + '/evidence.json', JSON.stringify(evidence, null, 2));
  writeFileSync(
    output + '/owned.json',
    JSON.stringify({ org, otherOrg, users: users.map((u) => u.id) }, null, 2),
  );
};
function sql(input) {
  try {
    return execFileSync(
      'docker',
      [
        'exec',
        '-i',
        'supabase_db_naql365',
        'psql',
        '-X',
        '-qAt',
        '-v',
        'ON_ERROR_STOP=1',
        '-v',
        'VERBOSITY=verbose',
        '-U',
        'postgres',
        '-d',
        'postgres',
      ],
      { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    ).trim();
  } catch (e) {
    throw Error(
      'LOCAL_SQL_' + (String(e.stderr).match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1] || 'UNCLASSIFIED'),
    );
  }
}
const client = () =>
  createClient(local.API_URL, local.PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
async function actor(index) {
  const c = client(),
    r = await c.auth.signInWithPassword({
      email: users[index].email,
      password: users[index].password,
    });
  if (r.error) throw Error('LOCAL_AUTH_FAILED');
  clients.push(c);
  return c;
}
async function rpc(c, name, args) {
  const r = await c.rpc(name, args);
  if (r.error) throw Error('LOCAL_RPC_' + name + '_' + r.error.code);
  return r.data;
}
async function createUser() {
  const email = 'driver-phase6-' + randomUUID() + '@example.invalid',
    password = randomBytes(24).toString('base64url');
  const r = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (r.error || !r.data.user) throw Error('LOCAL_FIXTURE_AUTH_FAILED');
  users.push({ id: r.data.user.id, email, password });
  save();
  return r.data.user.id;
}
async function capture(label, locale) {
  await page.evaluate(() => document.fonts.ready);
  const file = label + '-' + locale + '.png';
  await page.screenshot({ path: output + '/' + file, fullPage: true });
  evidence.captures.push({ label, locale, file });
  save();
}
try {
  if (
    !sql('show server_version;').startsWith('17.') ||
    sql('select count(*) from supabase_migrations.schema_migrations;') !== '51'
  )
    throw Error('LOCAL_SCHEMA_51_REQUIRED');
  checkpoint = 'build';
  execFileSync(process.execPath, ['scripts/guarded-next.mjs', 'build'], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 180000,
    maxBuffer: 16e6,
  });
  server = await startBrowserServer(env, 3017);
  checkpoint = 'owned fixtures';
  for (let i = 0; i < 7; i++) await createUser();
  const mapping = new Map([
    ['23000000-0000-4000-8000-000000000001', org],
    ['23000000-0000-4000-8000-000000000002', otherOrg],
    ...users.slice(0, 5).map((u, i) => ['13000000-0000-4000-8000-00000000000' + (i + 1), u.id]),
  ]);
  let fixture = readFileSync('supabase/tests/phase3.test.sql', 'utf8')
    .split('set local role authenticated;')[0]
    .replace('begin;', '')
    .replace(/create function public.phase3_assert[\s\S]*?end \$\$;/, '')
    .replace(/create function public.phase3_command[\s\S]*?end \$\$;/, '')
    .replace(/insert into auth.users\(id,email\)[\s\S]*?;/, '');
  fixture = fixture.replace(/'(?:[0-9a-f]{8}-[0-9a-f-]{27})'/g, (m) => {
    const v = m.slice(1, -1);
    if (!mapping.has(v)) mapping.set(v, randomUUID());
    return "'" + mapping.get(v) + "'";
  });
  fixture = fixture
    .replaceAll("id::text like '23000000%'", `id in ('${org}','${otherOrg}')`)
    .replaceAll(
      "organization_id::text like '23000000%'",
      `organization_id in ('${org}','${otherOrg}')`,
    )
    .replaceAll(
      "id::text like '13000000%'",
      `id in (${users
        .slice(0, 5)
        .map((u) => "'" + u.id + "'")
        .join(',')})`,
    )
    .replaceAll(
      "profile_id::text like '13000000%'",
      `profile_id in (${users
        .slice(0, 5)
        .map((u) => "'" + u.id + "'")
        .join(',')})`,
    );
  fixture = fixture
    .replaceAll("'SA'", "'EG'")
    .replaceAll("'SAR'", "'EGP'")
    .replaceAll('Asia/Riyadh', 'Africa/Cairo')
    .replace('O-N365-202609-930001', 'O-N365-202610-' + String(Date.now()).slice(-6));
  fixture = fixture
    .replaceAll("md5(id::text||'EG')::uuid", 'gen_random_uuid()')
    .replaceAll("md5(id::text||'region')::uuid", 'gen_random_uuid()')
    .replaceAll('md5(m.id::text||c.code)::uuid', 'gen_random_uuid()')
    .replaceAll(
      "md5(('" + org + "')::text||'EG')::uuid",
      "(select id from public.markets where organization_id='" + org + "')",
    );
  if (/\b(?:create|alter|drop|truncate)\b/i.test(fixture)) throw Error('FIXTURE_DDL_DENIED');
  sql('begin;' + fixture + 'commit;');
  seeded = true;
  sql(
    `insert into public.organization_memberships(organization_id,profile_id,member_type) values('${org}','${users[5].id}','driver'),('${org}','${users[6].id}','driver');insert into public.user_roles(organization_id,profile_id,role_id) select '${org}',u.id,r.id from auth.users u cross join public.roles r where u.id in ('${users[5].id}','${users[6].id}') and r.code='DRIVER';`,
  );
  const staff = await actor(0),
    customer = await actor(1),
    crossOrg = await actor(3),
    driver = await actor(5),
    otherDriver = await actor(6),
    market = sql(`select id from public.markets where organization_id='${org}'`),
    city = sql(`select id from public.market_cities where organization_id='${org}' limit 1`);
  const op = async (action, id, payload = {}) =>
    rpc(staff, 'operations_command', {
      p_organization_id: org,
      p_action: action,
      p_entity_id: id,
      p_revision: Number(
        sql(`select coalesce((select revision from public.trips where id='${id}'),0)`),
      ),
      p_mutation_id: randomUUID(),
      p_payload: payload,
    });
  const a = (
      await op('create_driver', org, { marketId: market, type: 'INTERNAL', name: 'TEST Driver' })
    ).id,
    b = (
      await op('create_driver', org, {
        marketId: market,
        type: 'INTERNAL',
        name: 'TEST Other Driver',
      })
    ).id;
  sql(
    `update public.drivers set profile_id='${users[5].id}' where id='${a}';update public.drivers set profile_id='${users[6].id}' where id='${b}';`,
  );
  const vehicle = (
      await op('create_vehicle', org, {
        marketId: market,
        type: 'Truck',
        identifier: 'TEST-DRIVER-LOCAL',
      })
    ).id,
    job = (await op('create_job', mapping.get('83000000-0000-4000-8000-000000000001'))).id,
    trip = (await op('create_trip', job)).id;
  await op('plan', trip, {
    plannedStart: new Date().toISOString(),
    plannedEnd: new Date(Date.now() + 3600000).toISOString(),
    stops: [
      {
        cityId: city,
        kind: 'PICKUP',
        address: 'TEST Cairo pickup',
        notes: 'STAFF PRIVATE TEST NOTE',
        pickups: [],
      },
      { cityId: city, kind: 'DELIVERY', address: 'TEST delivery', pickups: [0] },
    ],
  });
  await op('assign', trip, { driverId: a, vehicleId: vehicle });
  await op('ready', trip);
  checkpoint = 'RPC authorization';
  for (const denied of [customer, staff, otherDriver, crossOrg])
    expect((await denied.rpc('driver_trip', { p_trip: trip })).error).not.toBeNull();
  // Fixture preflight only; the application still parses the full authoritative Driver schema.
  z.object({
    id: z.uuid(),
    market: z.object({ id: z.uuid() }),
    stops: z.array(z.object({ id: z.uuid() })),
  }).parse(await rpc(driver, 'driver_trip', { p_trip: trip }));
  expect(JSON.stringify(await rpc(driver, 'driver_trip', { p_trip: trip }))).not.toContain(
    'STAFF PRIVATE TEST NOTE',
  );
  evidence.checks.push('assigned identity / Customer / Staff / other Driver / organization denial');
  expect(
    (
      await otherDriver.rpc('publish_trip_location', {
        p_trip: trip,
        p_sample: randomUUID(),
        p_location: {
          latitude: 30,
          longitude: 31,
          accuracy: 10,
          capturedAt: new Date().toISOString(),
          clientType: 'WEB',
        },
      })
    ).error,
  ).not.toBeNull();
  evidence.checks.push('unauthorized location publication denied');
  browser = await chromium.launch();
  for (const locale of ['ar', 'en']) {
    checkpoint = 'browser ' + locale;
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    try {
      page = await context.newPage();
      checkpoint = 'login page ' + locale;
      await page.goto(origin + '/' + locale + '/driver/login');
      await page.locator('#driver-email').fill(users[5].email);
      await page.locator('#driver-password').fill(users[5].password);
      await page
        .locator('form')
        .filter({ has: page.locator('#driver-email') })
        .getByRole('button', { name: locale === 'ar' ? 'تسجيل الدخول' : 'Sign in', exact: true })
        .click();
      checkpoint = 'login redirect ' + locale;
      await expect(page).toHaveURL(origin + '/' + locale + '/driver');
      checkpoint = 'assigned list ' + locale;
      await expect(page.locator('.driver-trip-card')).toHaveCount(1);
      await capture('dashboard', locale);
      await page.goto(origin + '/' + locale + '/driver/trips/' + trip);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.locator('main')).not.toContainText('STAFF PRIVATE TEST NOTE');
      await expect(page.locator('.driver-command button').first()).toBeEnabled();
      expect(
        (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
          .violations,
      ).toEqual([]);
      await capture('detail', locale);
      if (locale === 'en') {
        const state = () => rpc(driver, 'driver_trip', { p_trip: trip });
        const action = async (name) => {
          checkpoint = 'UI ' + name;
          const before = await state();
          await page
            .getByRole('button', {
              name:
                name === 'dispatch'
                  ? driverDictionary(locale).startTrip
                  : operationLabel(name, locale),
              exact: true,
            })
            .click();
          await expect.poll(async () => (await state()).revision).toBeGreaterThan(before.revision);
          await page.reload();
        };
        await action('dispatch');
        const tracking = await page.request.get(
          origin + '/api/tracking?mode=driver&tripId=' + trip,
        );
        expect(tracking.status()).toBe(200);
        expect(JSON.stringify(await tracking.json())).not.toContain('STAFF PRIVATE TEST NOTE');
        evidence.checks.push('authorized foreground tracking projection');
        for (let index = 0; index < 2; index++) {
          if (index) await action('depart');
          await action('arrive');
          await action('start_service');
          await action('complete_stop');
        }
        expect((await state()).status).toBe('DELIVERED');
        evidence.checks.push('real Driver start / Stop transitions');
        checkpoint = 'POD upload';
        await page.locator('#pod-recipient').fill('TEST Recipient');
        const png = await sharp({
          create: { width: 640, height: 240, channels: 3, background: '#ffffff' },
        })
          .composite([
            {
              input: Buffer.from(
                '<svg width="640" height="240"><path d="M20 150 L150 40 L280 180 L450 60" stroke="black" stroke-width="10" fill="none"/></svg>',
              ),
            },
          ])
          .png()
          .toBuffer();
        await page
          .locator('#pod-file')
          .setInputFiles({ name: 'signature.png', mimeType: 'image/png', buffer: png });
        await page
          .getByRole('button', { name: driverDictionary(locale).submitPod, exact: true })
          .click();
        await expect
          .poll(async () => sql(`select state from public.trip_pods where trip_id='${trip}'`))
          .toBe('FINAL');
        await page.reload();
        await capture('pod-final', locale);
        const pod = JSON.parse(
          sql(`select row_to_json(p) from public.trip_pods p where trip_id='${trip}'`),
        );
        for (const denied of [customer, otherDriver])
          expect(
            (await denied.storage.from('pod-files').createSignedUrl(pod.object_name, 30)).error,
          ).not.toBeNull();
        const publicFile = await fetch(
          local.API_URL + '/storage/v1/object/public/pod-files/' + pod.object_name,
        );
        expect(publicFile.ok).toBe(false);
        evidence.checks.push('real private POD / customer and other Driver denial');
        await action('complete_trip');
        expect((await state()).status).toBe('COMPLETED');
        await capture('history', locale);
      }
      checkpoint = 'logout ' + locale;
      await page.locator('.driver-toolbar form').getByRole('button').click();
      await expect(page).toHaveURL(origin + '/' + locale + '/driver/login');
      await page.goto(origin + '/' + locale + '/driver');
      await expect(page).toHaveURL(origin + '/' + locale + '/driver/login');
      evidence.checks.push(locale + ' login / refresh / logout');
    } catch (error) {
      evidence.browserBoundary = {
        checkpoint,
        route: new URL(page.url()).pathname.replace(/[a-f0-9-]{36}/g, ':id'),
        cards: await page.locator('.driver-trip-card').count(),
        alerts: await page.getByRole('alert').count(),
        workspace: await page.locator('.driver-workspace').count(),
        directRpcCount: (await driver.rpc('driver_trips', { p_view: 'today', p_offset: 0 })).data
          ?.length,
        matcher:
          ['toHaveURL', 'toHaveCount', 'toBeVisible', 'toBeEnabled', 'toEqual'].find((x) =>
            String(error.message).includes(x),
          ) || 'OTHER',
      };
      throw error;
    } finally {
      await context.close();
    }
  }
  evidence.pass = true;
} catch (error) {
  evidence.failure = {
    checkpoint,
    classification: error.name,
    code: /^LOCAL_[A-Z0-9_]+$/.test(error.message) ? error.message : 'ASSERTION_OR_BROWSER',
  };
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (server) await stopBrowserServer(server, 3017);
  if (seeded) {
    const paths = JSON.parse(
      sql(
        `select coalesce(json_agg(object_name),'[]'::json) from public.trip_pods where organization_id='${org}'`,
      ),
    );
    if (paths.length) {
      const r = await admin.storage.from('pod-files').remove(paths);
      if (r.error) throw Error('LOCAL_STORAGE_CLEANUP_FAILED');
    }
    const tables = [
      'public.trip_event_locations',
      'public.issue_photos',
      'public.issues',
      'public.trip_pods',
      'public.trip_events',
      'public.trip_stop_dependencies',
      'public.trip_stops',
      'public.assignments',
      'public.trips',
      'public.jobs',
      'private.operational_mutations',
      'private.payment_mutations',
      'public.payment_transactions',
      'public.payments',
      'public.orders',
      'public.quote_versions',
      'public.quotes',
      'public.requests',
      'public.customers',
      'public.drivers',
      'public.vehicles',
      'public.user_roles',
      'public.organization_memberships',
      'public.market_cities',
      'public.market_regions',
      'public.markets',
      'public.audit_logs',
    ];
    sql(
      `begin;set local app.fixture_cleanup='on';delete from private.completed_trip_assignments where trip_id in (select id from public.trips where organization_id='${org}');delete from private.driver_mutations where actor_id in ('${users[5]?.id}','${users[6]?.id}');${tables.map((t) => `delete from ${t} where organization_id in ('${org}','${otherOrg}');`).join('')}delete from public.organizations where id in ('${org}','${otherOrg}');commit;`,
    );
    expect(
      sql(`select count(*) from public.organizations where id in ('${org}','${otherOrg}')`),
    ).toBe('0');
  }
  for (const u of users) {
    const r = await admin.auth.admin.deleteUser(u.id);
    if (r.error) throw Error('LOCAL_AUTH_CLEANUP_FAILED');
  }
  if (users.length) {
    const reused = await client().auth.signInWithPassword({
      email: users[5]?.email || users[0].email,
      password: users[5]?.password || users[0].password,
    });
    expect(reused.error).not.toBeNull();
    evidence.credentialReuseDenied = true;
  }
  evidence.cleanup = true;
  save();
  console.log(
    JSON.stringify({
      pass: evidence.pass,
      checks: evidence.checks.length,
      captures: evidence.captures.length,
      cleanup: evidence.cleanup,
      credentialReuseDenied: evidence.credentialReuseDenied,
      failure: evidence.failure,
    }),
  );
}

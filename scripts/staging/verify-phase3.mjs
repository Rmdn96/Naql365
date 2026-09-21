import { randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { stagingProject, supabase, query } from './supabase.mjs';
import { acquireHostedRun } from './exclusive-run.mjs';
process.chdir(fileURLToPath(new URL('../../', import.meta.url)));
const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--assets-only')) throw new Error('Unknown verification option');
// Supplemental bundle inspection is useful after a completed journey; it is not full acceptance.
const selectedTests = args.includes('--assets-only') ? ['tests/phase3/assets.spec.ts'] : [];
const origin = process.env.STAGING_BASE_URL;
if (
  !origin ||
  !/^https:\/\/naql365-staging-[a-z0-9-]+\.vercel\.app$/.test(origin) ||
  !process.env.VERCEL_AUTOMATION_BYPASS_SECRET
)
  throw new Error('Verified protected Phase 3 Preview required');
const release = acquireHostedRun();
const users = [];
const otherOrg = randomUUID();
let ref, admin, org;
try {
  ref = stagingProject();
  org = query(ref, 'select organization_id from private.customer_enrollment where singleton')[0]
    ?.organization_id;
  if (!org) throw new Error('Staging catalogue unavailable');
  const keys = JSON.parse(
    supabase(['projects', 'api-keys', '--project-ref', ref, '--reveal', '--output', 'json']),
  );
  const adminKey = keys.find((k) => k.type === 'secret')?.api_key,
    publicKey = keys.find((k) => k.type === 'publishable')?.api_key;
  if (!adminKey || !publicKey) throw new Error('Staging keys unavailable');
  const url = `https://${ref}.supabase.co`;
  admin = createClient(url, adminKey, { auth: { persistSession: false, autoRefreshToken: false } });
  query(
    ref,
    `insert into public.organizations(id,name) values('${otherOrg}','Phase 3 isolation fixture');select private.provision_initial_market_catalogue('${otherOrg}');update public.markets set active=true where organization_id='${otherOrg}'`,
  );
  const identities = {};
  for (const label of ['customer', 'sales', 'operations', 'peer', 'other']) {
    const email = `naql365-phase3-${label}-${randomUUID()}@example.test`,
      password = randomBytes(32).toString('base64url');
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'SUPER_ADMIN' },
    });
    if (created.error || !created.data.user) throw new Error('Fixture identity unavailable');
    const id = created.data.user.id;
    users.push(id);
    identities[label] = { email, password, id };
    if (label !== 'customer') {
      const tenant = label === 'other' ? otherOrg : org;
      const type = label === 'peer' ? 'customer' : 'staff',
        role = label === 'peer' ? 'CUSTOMER' : label === 'sales' ? 'SALES' : 'DISPATCHER';
      query(
        ref,
        `begin;insert into public.organization_memberships(organization_id,profile_id,member_type) values('${tenant}','${id}','${type}');insert into public.user_roles(organization_id,profile_id,role_id) select '${tenant}','${id}',id from public.roles where code='${role}';${label === 'peer' ? `insert into public.customers(organization_id,profile_id) values('${org}','${id}');` : ''}commit;`,
      );
    }
  }
  const code = await new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [
        'node_modules/@playwright/test/cli.js',
        'test',
        ...selectedTests,
        '--config',
        'playwright.phase3.config.ts',
      ],
      {
        env: {
          ...process.env,
          STAGING_PHASE3_ORG: org,
          STAGING_PHASE3_OTHER_ORG: otherOrg,
          STAGING_PHASE3_IDENTITIES: JSON.stringify(identities),
          STAGING_TEST_API_URL: url,
          STAGING_TEST_PUBLIC_KEY: publicKey,
          STAGING_TEST_ADMIN_KEY: adminKey,
        },
        stdio: 'inherit',
      },
    );
    child.on('exit', resolve);
    child.on('error', () => resolve(1));
  });
  if (code !== 0) process.exitCode = 1;
} catch {
  console.error('Phase 3 hosted acceptance failed; sensitive details withheld');
  process.exitCode = 1;
} finally {
  try {
    if (ref && admin && users.length) {
      const ids = users.map((id) => `'${id}'`).join(',');
      const files = query(
        ref,
        `select bucket_id,object_name from public.file_objects where owner_profile_id in (${ids}) union all select 'pod-files',object_name from public.trip_pods where actor_id in (${ids})`,
      );
      for (const f of files) {
        const r = await admin.storage.from(f.bucket_id).remove([f.object_name]);
        if (r.error) throw new Error('Fixture file cleanup failed');
      }
      query(
        ref,
        `begin;set local app.fixture_cleanup='on';
    create temporary table cleanup_requests as select r.id from public.requests r join public.customers c on c.id=r.customer_id where c.profile_id in (${ids});
    create temporary table cleanup_quotes as select q.id from public.quotes q where request_id in(select id from cleanup_requests);
    create temporary table cleanup_versions as select id from public.quote_versions where quote_id in(select id from cleanup_quotes);
    create temporary table cleanup_orders as select id from public.orders where customer_id in(select id from public.customers where profile_id in (${ids}));
    create temporary table cleanup_jobs as select id from public.jobs where order_id in(select id from cleanup_orders);
    create temporary table cleanup_trips as select id from public.trips where job_id in(select id from cleanup_jobs);
    create temporary table cleanup_resources as select (result->>'id')::uuid as id,intent->>'action' as action from private.operational_mutations where actor_id in (${ids}) and intent->>'action' in ('create_driver','create_vehicle');
    delete from public.trip_pods where trip_id in(select id from cleanup_trips);
    delete from public.trip_events where trip_id in(select id from cleanup_trips);
    delete from public.trip_stop_dependencies where trip_id in(select id from cleanup_trips);
    delete from public.trip_stops where trip_id in(select id from cleanup_trips);
    delete from public.assignments where trip_id in(select id from cleanup_trips);
    delete from public.trips where id in(select id from cleanup_trips);delete from public.jobs where id in(select id from cleanup_jobs);
    delete from public.drivers where id in(select id from cleanup_resources where action='create_driver');delete from public.vehicles where id in(select id from cleanup_resources where action='create_vehicle');
    delete from private.payment_mutations where actor_id in (${ids});
    delete from public.payment_transactions where payment_id in(select id from public.payments where order_id in(select id from cleanup_orders));
    delete from public.payments where order_id in(select id from cleanup_orders);
    delete from private.operational_mutations where actor_id in (${ids});delete from public.orders where id in(select id from cleanup_orders);
    delete from public.quote_items where quote_version_id in(select id from cleanup_versions);delete from public.quote_pricing_details where quote_version_id in(select id from cleanup_versions);
    delete from public.quote_versions where id in(select id from cleanup_versions);delete from public.quotes where id in(select id from cleanup_quotes);
    delete from public.pricing_evaluation_components where evaluation_id in(select id from public.pricing_evaluations where request_id in(select id from cleanup_requests));
    delete from public.pricing_evaluations where request_id in(select id from cleanup_requests);delete from public.distance_snapshots where request_id in(select id from cleanup_requests);
    delete from public.request_attachments where request_id in(select id from cleanup_requests);delete from public.file_objects where owner_profile_id in (${ids});
    delete from public.request_additional_services where request_id in(select id from cleanup_requests);delete from public.request_locations where request_id in(select id from cleanup_requests);delete from public.request_items where request_id in(select id from cleanup_requests);delete from public.requests where id in(select id from cleanup_requests);
    delete from public.customers where profile_id in (${ids});delete from public.user_roles where profile_id in (${ids});delete from public.organization_memberships where profile_id in (${ids});delete from public.audit_logs where actor_id in (${ids});commit;`,
      );
      for (const id of users) {
        if ((await admin.auth.admin.deleteUser(id)).error)
          throw new Error('Fixture identity cleanup failed');
      }
      query(
        ref,
        `begin;delete from public.market_cities where organization_id='${otherOrg}';delete from public.market_regions where organization_id='${otherOrg}';delete from public.markets where organization_id='${otherOrg}';delete from public.audit_logs where organization_id='${otherOrg}';delete from public.organizations where id='${otherOrg}';commit;`,
      );
      const remaining = query(
        ref,
        `select count(*)::integer as count from auth.users where id in (${ids})`,
      )[0]?.count;
      if (remaining !== 0) throw new Error('Fixture cleanup incomplete');
    }
    console.log('Phase 3 synthetic fixture cleanup PASS; existing catalogues retained');
  } catch {
    console.error('Phase 3 cleanup incomplete; scoped identifiers withheld');
    process.exitCode = 1;
  } finally {
    release();
  }
}

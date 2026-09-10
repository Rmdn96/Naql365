import { randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { stagingProject, supabase, query } from './supabase.mjs';
import { acquireHostedRun } from './exclusive-run.mjs';

process.chdir(fileURLToPath(new URL('../../', import.meta.url)));
const origin = process.env.STAGING_BASE_URL;
if (
  !origin ||
  !/^https:\/\/naql365-staging-[a-z0-9-]+\.vercel\.app$/.test(origin) ||
  !process.env.VERCEL_AUTOMATION_BYPASS_SECRET
)
  throw new Error('Verified protected Preview required');

const release = acquireHostedRun();
const users = [];
const requestIds = [randomUUID(), randomUUID(), randomUUID()];
let ref, admin, org;
try {
  ref = stagingProject();
  org = query(ref, 'select organization_id from private.customer_enrollment where singleton')[0]
    ?.organization_id;
  if (!org) throw new Error('Configure Staging first');
  const keys = JSON.parse(
    supabase(['projects', 'api-keys', '--project-ref', ref, '--reveal', '--output', 'json']),
  );
  const url = `https://${ref}.supabase.co`,
    adminKey = keys.find((key) => key.type === 'secret')?.api_key,
    publicKey = keys.find((key) => key.type === 'publishable')?.api_key;
  if (!adminKey || !publicKey) throw new Error('Staging API keys unavailable');
  admin = createClient(url, adminKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const identities = [];
  for (const label of ['customer', 'sales', 'peer']) {
    const email = `naql365-phase2-${label}-${randomUUID()}@example.test`,
      password = randomBytes(32).toString('base64url');
    const result = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'SUPER_ADMIN', organization_id: randomUUID() },
    });
    if (result.error || !result.data.user) throw new Error('Synthetic identity creation failed');
    users.push(result.data.user.id);
    identities.push({ email, password });
  }
  const service = query(
    ref,
    `select id from public.services where organization_id='${org}' and code='furniture' and active`,
  )[0]?.id;
  if (!service) throw new Error('Staging catalogue unavailable');
  const referenceBase = 900000 + (Date.now() % 90000);
  const fixtureValues = requestIds
    .map((id, index) => `('${id}'::uuid,'N365-202609-${referenceBase + index}')`)
    .join(',');
  const requestList = requestIds.map((id) => `'${id}'`).join(',');
  query(
    ref,
    `begin;
   insert into public.organization_memberships(organization_id,profile_id,member_type) values ('${org}','${users[0]}','customer'),('${org}','${users[1]}','staff'),('${org}','${users[2]}','customer');
   insert into public.user_roles(organization_id,profile_id,role_id) select '${org}',profile_id,r.id from public.organization_memberships m cross join public.roles r where m.profile_id in ('${users[0]}','${users[2]}') and r.code='CUSTOMER';
   insert into public.user_roles(organization_id,profile_id,role_id) select '${org}','${users[1]}',id from public.roles where code='SALES';
   insert into public.customers(organization_id,profile_id) values('${org}','${users[0]}'),('${org}','${users[2]}');
   insert into public.requests(id,organization_id,customer_id,status,revision,service_id,reference,submitted_at,contact_name,contact_phone,contact_email)
    select fixture.id,'${org}',c.id,'SUBMITTED',1,'${service}',fixture.reference,now(),'Phase 2 fixture','+966500000001','fixture@example.invalid' from public.customers c cross join (values ${fixtureValues}) fixture(id,reference) where c.profile_id='${users[0]}';
   insert into public.request_locations(request_id,organization_id,kind,city,district,address) select id,'${org}','pickup','Riyadh','Fixture','Harmless pickup' from public.requests where id in (${requestList});
   insert into public.request_locations(request_id,organization_id,kind,city,district,address) select id,'${org}','delivery','Riyadh','Fixture','Harmless delivery' from public.requests where id in (${requestList}); commit;`,
  );
  const env = {
    ...process.env,
    STAGING_PHASE2_CUSTOMER_EMAIL: identities[0].email,
    STAGING_PHASE2_CUSTOMER_PASSWORD: identities[0].password,
    STAGING_PHASE2_CUSTOMER_ID: users[0],
    STAGING_PHASE2_SALES_EMAIL: identities[1].email,
    STAGING_PHASE2_SALES_PASSWORD: identities[1].password,
    STAGING_PHASE2_PEER_EMAIL: identities[2].email,
    STAGING_PHASE2_PEER_PASSWORD: identities[2].password,
    STAGING_PHASE2_REQUEST_IDS: JSON.stringify(requestIds),
    STAGING_TEST_API_URL: url,
    STAGING_TEST_PUBLIC_KEY: publicKey,
    STAGING_TEST_ADMIN_KEY: adminKey,
  };
  const code = await new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      ['node_modules/@playwright/test/cli.js', 'test', '--config', 'playwright.phase2.config.ts'],
      { env, stdio: 'inherit' },
    );
    child.on('exit', resolve);
  });
  if (code !== 0) process.exitCode = 1;
} catch {
  console.error('Phase 2 acceptance setup failed; sensitive details withheld');
  process.exitCode = 1;
} finally {
  try {
    if (ref && users.length) {
      const ids = users.map((id) => `'${id}'`).join(',');
      query(
        ref,
        `begin; select set_config('app.fixture_cleanup','on',true);
       delete from public.orders where customer_id in(select id from public.customers where profile_id in (${ids}));
       delete from public.quote_items where quote_version_id in(select v.id from public.quote_versions v join public.quotes q on q.id=v.quote_id join public.requests r on r.id=q.request_id join public.customers c on c.id=r.customer_id where c.profile_id in (${ids}));
       delete from public.quote_pricing_details where quote_version_id in(select v.id from public.quote_versions v join public.quotes q on q.id=v.quote_id join public.requests r on r.id=q.request_id join public.customers c on c.id=r.customer_id where c.profile_id in (${ids}));
       delete from public.quote_versions where quote_id in(select q.id from public.quotes q join public.requests r on r.id=q.request_id join public.customers c on c.id=r.customer_id where c.profile_id in (${ids}));
       delete from public.quotes where request_id in(select r.id from public.requests r join public.customers c on c.id=r.customer_id where c.profile_id in (${ids}));
       delete from public.pricing_evaluation_components where evaluation_id in(select e.id from public.pricing_evaluations e join public.requests r on r.id=e.request_id join public.customers c on c.id=r.customer_id where c.profile_id in (${ids}));
       delete from public.pricing_evaluations where request_id in(select r.id from public.requests r join public.customers c on c.id=r.customer_id where c.profile_id in (${ids}));
       delete from public.distance_snapshots where request_id in(select r.id from public.requests r join public.customers c on c.id=r.customer_id where c.profile_id in (${ids}));
       delete from public.request_attachments where request_id in(select r.id from public.requests r join public.customers c on c.id=r.customer_id where c.profile_id in (${ids}));
       delete from public.request_additional_services where request_id in(select r.id from public.requests r join public.customers c on c.id=r.customer_id where c.profile_id in (${ids}));
       delete from public.request_locations where request_id in(select r.id from public.requests r join public.customers c on c.id=r.customer_id where c.profile_id in (${ids}));
       delete from public.request_items where request_id in(select r.id from public.requests r join public.customers c on c.id=r.customer_id where c.profile_id in (${ids}));
       delete from public.requests where customer_id in(select id from public.customers where profile_id in (${ids}));
       delete from public.customers where profile_id in (${ids}); delete from public.user_roles where profile_id in (${ids}); delete from public.organization_memberships where profile_id in (${ids}); delete from public.audit_logs where actor_id in (${ids}); commit;`,
      );
      for (const id of users)
        if ((await admin.auth.admin.deleteUser(id)).error) throw new Error('Auth cleanup failed');
    }
    console.log('Phase 2 acceptance fixture cleanup PASS; pricing configuration retained');
  } catch {
    console.error('Phase 2 cleanup failed; scoped identifiers withheld');
    process.exitCode = 1;
  } finally {
    release();
  }
}

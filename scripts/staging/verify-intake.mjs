import { randomUUID, randomBytes } from 'node:crypto';
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
const release = acquireHostedRun(),
  users = [],
  otherOrg = randomUUID(),
  peerRequest = randomUUID(),
  otherRequest = randomUUID();
let ref, admin, org;
try {
  ref = stagingProject();
  org = query(ref, 'select organization_id from private.customer_enrollment where singleton')[0]
    ?.organization_id;
  if (!org) throw new Error('Configure Staging intake first');
  const keys = JSON.parse(
    supabase(['projects', 'api-keys', '--project-ref', ref, '--reveal', '--output', 'json']),
  );
  const url = `https://${ref}.supabase.co`,
    adminKey = keys.find((k) => k.type === 'secret').api_key,
    publicKey = keys.find((k) => k.type === 'publishable').api_key;
  admin = createClient(url, adminKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `naql365-intake-${randomUUID()}@example.test`,
    password = randomBytes(32).toString('base64url');
  for (let i = 0; i < 3; i++) {
    const result = await admin.auth.admin.createUser({
      email: i === 0 ? email : `naql365-intake-peer-${randomUUID()}@example.test`,
      password: i === 0 ? password : randomBytes(32).toString('base64url'),
      email_confirm: true,
      user_metadata: { role: 'SUPER_ADMIN' },
    });
    if (result.error || !result.data.user) throw new Error('Synthetic identity creation failed');
    users.push(result.data.user.id);
  }
  query(
    ref,
    `begin;
 insert into public.organizations(id,name) values('${otherOrg}','Naql365 intake isolation fixture');
 select private.provision_initial_market_catalogue('${otherOrg}');
 insert into public.organization_memberships(organization_id,profile_id,member_type) values('${org}','${users[1]}','customer'),('${otherOrg}','${users[2]}','customer');
 insert into public.user_roles(organization_id,profile_id,role_id) select organization_id,profile_id,r.id from public.organization_memberships m cross join public.roles r where m.profile_id in ('${users[1]}','${users[2]}') and r.code='CUSTOMER';
 insert into public.customers(organization_id,profile_id) values('${org}','${users[1]}'),('${otherOrg}','${users[2]}');
 insert into public.requests(id,organization_id,customer_id,market_id) select case when c.profile_id='${users[1]}' then '${peerRequest}'::uuid else '${otherRequest}'::uuid end,c.organization_id,c.id,m.id from public.customers c join public.markets m on m.organization_id=c.organization_id and m.country_code='SA' where c.profile_id in ('${users[1]}','${users[2]}');commit;`,
  );
  const env = {
    ...process.env,
    STAGING_TEST_USER_EMAIL: email,
    STAGING_TEST_USER_PASSWORD: password,
    STAGING_TEST_PROFILE_ID: users[0],
    STAGING_TEST_ORG_ID: org,
    STAGING_TEST_PEER_REQUEST_ID: peerRequest,
    STAGING_TEST_OTHER_REQUEST_ID: otherRequest,
    STAGING_TEST_API_URL: url,
    STAGING_TEST_PUBLIC_KEY: publicKey,
    STAGING_TEST_ADMIN_KEY: adminKey,
  };
  const code = await new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      ['node_modules/@playwright/test/cli.js', 'test', '--config', 'playwright.intake.config.ts'],
      { env, stdio: 'inherit' },
    );
    child.on('exit', resolve);
  });
  if (code !== 0) process.exitCode = 1;
} catch {
  console.error('Intake acceptance setup failed; sensitive details withheld');
  process.exitCode = 1;
} finally {
  try {
    if (ref && users.length) {
      const ids = users.map((id) => `'${id}'`).join(',');
      const files = query(
        ref,
        `select bucket_id,object_name from public.file_objects where owner_profile_id in (${ids})`,
      );
      for (const f of files) {
        const removed = await admin.storage.from(f.bucket_id).remove([f.object_name]);
        if (removed.error) throw new Error('Storage cleanup failed');
      }
      query(
        ref,
        `begin;
    delete from public.request_attachments where request_id in(select r.id from public.requests r join public.customers c on c.id=r.customer_id where c.profile_id in (${ids}));
    delete from public.request_additional_services where request_id in(select r.id from public.requests r join public.customers c on c.id=r.customer_id where c.profile_id in (${ids}));
    delete from public.request_locations where request_id in(select r.id from public.requests r join public.customers c on c.id=r.customer_id where c.profile_id in (${ids}));
    delete from public.request_items where request_id in(select r.id from public.requests r join public.customers c on c.id=r.customer_id where c.profile_id in (${ids}));
    delete from public.requests where customer_id in(select id from public.customers where profile_id in (${ids}));
    delete from public.file_objects where owner_profile_id in (${ids});
    delete from public.customers where profile_id in (${ids});
    delete from public.user_roles where profile_id in (${ids});
    delete from public.organization_memberships where profile_id in (${ids});
    delete from public.market_cities where organization_id='${otherOrg}';
    delete from public.market_regions where organization_id='${otherOrg}';
    delete from public.markets where organization_id='${otherOrg}';
    delete from public.audit_logs where actor_id in (${ids}) or organization_id='${otherOrg}' or entity_id in (${ids});
    delete from public.organizations where id='${otherOrg}';commit;`,
      );
      for (const id of users)
        if ((await admin.auth.admin.deleteUser(id)).error) throw new Error('Auth cleanup failed');
    }
    console.log('Intake acceptance fixture cleanup PASS; configured catalogues retained');
  } catch {
    console.error('Intake cleanup failed; inspect scoped fixture IDs');
    console.error(JSON.stringify({ users, otherOrg }));
    process.exitCode = 1;
  } finally {
    release();
  }
}

import { randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { stagingProject, supabase, query } from './supabase.mjs';
import { acquireHostedRun } from './exclusive-run.mjs';
const origin = process.env.STAGING_BASE_URL;
if (
  !origin ||
  !/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin) ||
  !process.env.VERCEL_AUTOMATION_BYPASS_SECRET
)
  throw new Error('Verified protected Vercel Preview origin and automation credential required');
process.chdir(fileURLToPath(new URL('../../', import.meta.url)));
const org = randomUUID(),
  otherOrg = randomUUID(),
  fileId = randomUUID(),
  peerFileId = randomUUID();
let ref, admin, user, peer, path, peerPath;
const release = acquireHostedRun();
try {
  ref = stagingProject();
  const keys = JSON.parse(
    supabase(['projects', 'api-keys', '--project-ref', ref, '--reveal', '--output', 'json']),
  );
  admin = createClient(
    `https://${ref}.supabase.co`,
    keys.find((k) => k.type === 'secret').api_key,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const email = `naql365-browser-${randomUUID()}@example.test`,
    password = randomBytes(32).toString('base64url');
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'SUPER_ADMIN' },
  });
  if (created.error || !created.data.user) throw new Error('Fixture creation failed');
  user = created.data.user.id;
  const peerCreated = await admin.auth.admin.createUser({
    email: `naql365-peer-${randomUUID()}@example.test`,
    password: randomBytes(32).toString('base64url'),
    email_confirm: true,
  });
  if (peerCreated.error || !peerCreated.data.user) throw new Error('Peer fixture creation failed');
  peer = peerCreated.data.user.id;
  query(
    ref,
    `begin; insert into public.organizations(id,name) values ('${org}','Naql365 hosted browser fixture'),('${otherOrg}','Naql365 hosted browser isolation'); insert into public.organization_memberships(organization_id,profile_id,member_type) values ('${org}','${user}','customer'),('${org}','${peer}','customer'); insert into public.user_roles(organization_id,profile_id,role_id) select organization_id,profile_id,r.id from public.organization_memberships m cross join public.roles r where m.organization_id='${org}' and r.code='CUSTOMER'; insert into public.customers(organization_id,profile_id) values ('${org}','${user}'),('${org}','${peer}'); insert into public.file_objects(id,organization_id,owner_profile_id,bucket_id) values ('${fileId}','${org}','${user}','attachments'),('${peerFileId}','${org}','${peer}','attachments'); commit;`,
  );
  path = `${org}/${user}/${fileId}`;
  peerPath = `${org}/${peer}/${peerFileId}`;
  for (const object of [path, peerPath])
    if (
      (
        await admin.storage
          .from('attachments')
          .upload(
            object,
            new Blob(['%PDF-1.4\n% harmless fixture\n%%EOF'], { type: 'application/pdf' }),
            { contentType: 'application/pdf', cacheControl: '0' },
          )
      ).error
    )
      throw new Error('File fixture creation failed');
  const env = {
    ...process.env,
    STAGING_BASE_URL: origin,
    STAGING_TEST_USER_EMAIL: email,
    STAGING_TEST_USER_PASSWORD: password,
    STAGING_TEST_PROFILE_ID: user,
    STAGING_TEST_ORG_ID: org,
    STAGING_TEST_FILE_ID: fileId,
    STAGING_TEST_PEER_FILE_ID: peerFileId,
    STAGING_TEST_ADMIN_KEY: keys.find((k) => k.type === 'secret').api_key,
    STAGING_TEST_PUBLIC_KEY: keys.find((k) => k.type === 'publishable').api_key,
  };
  const child = spawn(
    process.execPath,
    ['node_modules/@playwright/test/cli.js', 'test', '--config', 'playwright.staging.config.ts'],
    { env, stdio: 'inherit' },
  );
  process.exitCode = await new Promise((resolve) => child.on('exit', resolve));
} catch {
  console.error('Hosted browser setup failed; private details suppressed');
  process.exitCode = 1;
} finally {
  try {
    if (path && (await admin.storage.from('attachments').remove([path, peerPath])).error)
      throw new Error();
    if (ref)
      query(
        ref,
        `begin; delete from public.file_objects where organization_id='${org}'; delete from public.customers where organization_id='${org}'; delete from public.user_roles where organization_id='${org}'; delete from public.organization_memberships where organization_id='${org}'; delete from public.audit_logs where organization_id in ('${org}','${otherOrg}'); delete from public.organizations where id in ('${org}','${otherOrg}'); commit;`,
      );
    if (user && (await admin.auth.admin.deleteUser(user)).error) throw new Error();
    if (peer && (await admin.auth.admin.deleteUser(peer)).error) throw new Error();
    console.log('Hosted browser fixture cleanup PASS');
  } catch {
    console.error('Hosted browser cleanup failed');
    process.exitCode = 1;
  } finally {
    release();
  }
}

import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { stagingProject, supabase, query } from './supabase.mjs';
import { acquireHostedRun } from './exclusive-run.mjs';

const users = [];
const orgA = randomUUID();
const orgB = randomUUID();
const fileId = randomUUID();
let ref, admin, path;
const release = acquireHostedRun();
function check(condition, label) {
  if (!condition) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}
try {
  ref = stagingProject();
  const keys = JSON.parse(
    supabase(['projects', 'api-keys', '--project-ref', ref, '--reveal', '--output', 'json']),
  );
  const publicKey = keys.find((key) => key.type === 'publishable')?.api_key;
  const secretKey = keys.find((key) => key.type === 'secret')?.api_key;
  if (!publicKey || !secretKey) throw new Error('Staging API keys unavailable');
  const url = `https://${ref}.supabase.co`;
  const options = {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  };
  admin = createClient(url, secretKey, options);
  for (let index = 0; index < 3; index++) {
    const email = `naql365-gate-${randomUUID()}@example.test`;
    const password = randomBytes(32).toString('base64url');
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'SUPER_ADMIN' },
    });
    if (error || !data.user) throw new Error('Staging fixture user creation failed');
    const client = createClient(url, publicKey, options);
    users.push({ id: data.user.id, client });
    const login = await client.auth.signInWithPassword({ email, password });
    check(!login.error && !!login.data.session, `Auth password login fixture ${index + 1}`);
    check(
      !(await client.auth.getUser()).error,
      `Auth server-verified identity fixture ${index + 1}`,
    );
  }
  check(
    query(
      ref,
      `select count(*)::integer as count from public.user_roles where profile_id in (${users.map((user) => `'${user.id}'`).join(',')})`,
    )[0].count === 0,
    'User metadata grants no role',
  );
  query(
    ref,
    `begin;
    insert into public.organizations(id,name) values ('${orgA}','Naql365 staging gate A'),('${orgB}','Naql365 staging gate B');
    ${users.map((user, index) => `insert into public.organization_memberships(organization_id,profile_id,member_type) values ('${index === 2 ? orgB : orgA}','${user.id}','customer');`).join('\n')}
    insert into public.user_roles(organization_id,profile_id,role_id) select m.organization_id,m.profile_id,r.id from public.organization_memberships m cross join public.roles r where m.organization_id in ('${orgA}','${orgB}') and r.code='CUSTOMER';
    insert into public.customers(organization_id,profile_id) select organization_id,profile_id from public.organization_memberships where organization_id in ('${orgA}','${orgB}');
    insert into public.file_objects(id,organization_id,owner_profile_id,bucket_id) values ('${fileId}','${orgA}','${users[0].id}','attachments');
    commit;`,
  );
  const owner = users[0].client;
  const peer = users[1].client;
  const other = users[2].client;
  const permission = (name) =>
    owner.rpc('has_permission', { organization_id: orgA, permission_code: name });
  check(
    (await permission('account.access')).data === true &&
      (await permission('portal.access')).data === false,
    'Real customer JWT has account permission and no staff permission',
  );
  const organizations = await owner.from('organizations').select('id');
  check(
    !organizations.error && organizations.data.length === 1 && organizations.data[0].id === orgA,
    'REST organization isolation',
  );
  const customers = await owner.from('customers').select('profile_id');
  check(
    !customers.error && customers.data.length === 1 && customers.data[0].profile_id === users[0].id,
    'REST same-tenant customer isolation',
  );
  check(
    !!(
      await owner
        .from('organization_memberships')
        .update({ member_type: 'staff' })
        .eq('profile_id', users[0].id)
    ).error,
    'REST membership self-promotion denied',
  );
  check(
    !!(await owner.from('audit_logs').insert({ action: 'forged', entity_type: 'roles' })).error,
    'REST audit tampering denied',
  );
  path = `${orgA}/${users[0].id}/${fileId}`;
  const fixture = new Blob(['%PDF-1.4\n% Naql365 non-sensitive staging fixture\n%%EOF\n'], {
    type: 'application/pdf',
  });
  check(
    !(
      await admin.storage
        .from('attachments')
        .upload(path, fixture, { contentType: 'application/pdf', cacheControl: '0' })
    ).error,
    'Private non-sensitive fixture uploaded',
  );
  check(
    !(await owner.storage.from('attachments').download(path)).error,
    'Authorized private object access',
  );
  check(
    !!(await peer.storage.from('attachments').download(path)).error,
    'Same-tenant other customer private access denied',
  );
  check(
    !!(await other.storage.from('attachments').download(path)).error,
    'Cross-tenant private access denied',
  );
  check(
    !(await fetch(`${url}/storage/v1/object/public/attachments/${path}`, { cache: 'no-store' })).ok,
    'No public object exposure',
  );
  check(
    !!(await other.storage.from('attachments').createSignedUrl(path, 60)).error,
    'Unauthorized signing denied',
  );
  const signed = await owner.storage.from('attachments').createSignedUrl(path, 60);
  check(!signed.error && !!signed.data, 'Authorized signed URL creation');
  check(
    (await fetch(signed.data.signedUrl, { cache: 'no-store' })).ok,
    'Signed URL works before expiry',
  );
  query(
    ref,
    `update public.organization_memberships set status='suspended' where organization_id='${orgA}' and profile_id='${users[0].id}'`,
  );
  check(
    (await permission('account.access')).data === false,
    'Suspension revokes permission with existing session',
  );
  check(
    (await owner.from('customers').select('id')).data?.length === 0,
    'Suspension revokes protected REST data',
  );
  check(
    !!(await owner.storage.from('attachments').download(path)).error,
    'Suspension revokes private download',
  );
  check(
    !!(await owner.storage.from('attachments').createSignedUrl(path, 60)).error,
    'Suspension revokes new signed URLs',
  );
  console.log('Waiting for the existing 60-second signed capability to expire');
  await new Promise((resolve) => setTimeout(resolve, 65000));
  check(
    !(await fetch(signed.data.signedUrl, { cache: 'no-store' })).ok,
    'Signed URL rejected after expiry',
  );
  const refreshed = await owner.auth.refreshSession();
  check(
    !refreshed.error && !!refreshed.data.session,
    'Auth refresh works independently of membership',
  );
  check(
    (await permission('account.access')).data === false,
    'Refreshed session cannot bypass suspension',
  );
  const refreshToken = refreshed.data.session.refresh_token;
  check(!(await owner.auth.signOut({ scope: 'local' })).error, 'Auth sign-out succeeds');
  const freshClient = createClient(url, publicKey, options);
  check(
    !!(await freshClient.auth.refreshSession({ refresh_token: refreshToken })).error,
    'Signed-out refresh token is revoked',
  );
  console.log(
    'Hosted services verification passed; application browser/SSR/PKCE remain separate gates',
  );
} catch (error) {
  console.error(
    error instanceof Error && /^(FAIL:|Staging|Explicit|Refusing|Supabase)/.test(error.message)
      ? error.message
      : 'Hosted verification failed; sensitive details suppressed',
  );
  process.exitCode = 1;
} finally {
  try {
    if (path && admin)
      check(
        !(await admin.storage.from('attachments').remove([path])).error,
        'Storage fixture cleanup',
      );
    if (ref)
      query(
        ref,
        `begin;
      delete from public.file_objects where id='${fileId}';
      delete from public.customers where organization_id in ('${orgA}','${orgB}');
      delete from public.user_roles where organization_id in ('${orgA}','${orgB}');
      delete from public.organization_memberships where organization_id in ('${orgA}','${orgB}');
      delete from public.audit_logs where organization_id in ('${orgA}','${orgB}');
      delete from public.organizations where id in ('${orgA}','${orgB}');
      commit;`,
      );
    for (const user of users)
      check(!(await admin.auth.admin.deleteUser(user.id)).error, 'Synthetic Auth user cleanup');
  } catch {
    console.error('Fixture cleanup failed; investigate scoped fixture records before another run');
    console.error(
      JSON.stringify({
        organizationIds: [orgA, orgB],
        profileIds: users.map((user) => user.id),
        fileId,
      }),
    );
    process.exitCode = 1;
  } finally {
    release();
  }
}

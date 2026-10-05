import { createHash, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { stagingProject, supabase, query } from './supabase.mjs';
import { acquireHostedRun } from './exclusive-run.mjs';

const release = acquireHostedRun();
let ref, requestId;
try {
  ref = stagingProject();
  const keys = JSON.parse(
    supabase(['projects', 'api-keys', '--project-ref', ref, '--reveal', '--output', 'json']),
  );
  const key = keys.find((item) => item.type === 'publishable')?.api_key;
  if (!key) throw Error('Staging publishable key unavailable');
  const client = (token) =>
    createClient(`https://${ref}.supabase.co`, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: token ? { 'x-naql365-guest': token } : {} },
    });
  const token = `g1_${randomBytes(32).toString('hex')}`;
  const created = await client().rpc('start_guest_request', {
    p_country: 'SA',
    p_creation_token: token,
  });
  if (created.error || !/^[a-f0-9-]{36}$/.test(created.data?.request?.id))
    throw Error('Guest probe setup failed');
  requestId = created.data.request.id;
  if ((await client(token).rpc('guest_access_state')).error)
    throw Error('Positive capability probe failed');
  query(
    ref,
    `update private.guest_access_grants set revoked_at=clock_timestamp() where request_id='${requestId}'`,
  );
  if (!(await client(token).rpc('guest_access_state')).error)
    throw Error('Revoked capability accepted');
  if (
    !(await client().rpc('start_guest_request', { p_country: 'SA', p_creation_token: token })).error
  )
    throw Error('Revoked creation replay accepted');
  const expired = `g1_${randomBytes(32).toString('hex')}`;
  const verifier = createHash('sha256').update(expired).digest('hex');
  query(
    ref,
    `insert into private.guest_access_grants(organization_id,customer_id,request_id,verifier,created_at,expires_at)
    select organization_id,customer_id,id,decode('${verifier}','hex'),clock_timestamp()-interval '2 days',clock_timestamp()-interval '1 day' from public.requests where id='${requestId}'`,
  );
  const exchange = await client(expired).rpc('guest_exchange_attempt');
  if (
    exchange.error ||
    exchange.data?.allowed !== false ||
    !(await client(expired).rpc('guest_access_state')).error
  )
    throw Error('Expired capability accepted');
  console.log('Hosted positive, revoked, expired and revoked-creation replay probes PASS');
} catch {
  console.error('Hosted guest capability verification failed; private details suppressed');
  process.exitCode = 1;
} finally {
  try {
    if (ref && requestId) {
      query(
        ref,
        `begin;set local app.fixture_cleanup='on';
        create temporary table probe_customers as select customer_id as id from public.requests where id='${requestId}';
        delete from private.guest_rate_budgets where subject in(select id from private.guest_access_grants where request_id='${requestId}');
        delete from public.audit_logs where entity_id='${requestId}' or metadata->>'guest_grant_id' in(select id::text from private.guest_access_grants where request_id='${requestId}');
        delete from private.guest_access_grants where request_id='${requestId}';
        delete from public.request_additional_services where request_id='${requestId}';
        delete from public.request_items where request_id='${requestId}';
        delete from public.request_locations where request_id='${requestId}';
        delete from public.requests where id='${requestId}';
        delete from public.customers where id in(select id from probe_customers);
        do $$ begin if exists(select 1 from public.requests where id='${requestId}') then raise exception 'Probe cleanup failed';end if;end $$;commit;`,
      );
      console.log('Hosted guest capability probe cleanup PASS');
    }
  } catch {
    console.error('Guest capability probe cleanup failed; scoped recovery required');
    process.exitCode = 1;
  } finally {
    release();
  }
}

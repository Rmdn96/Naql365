import { randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { stagingProject, supabase, query } from './supabase.mjs';
import { acquireHostedRun } from './exclusive-run.mjs';
export async function verifyDriverAcceptance(phase) {
  if (![4, 5, 6, 7].includes(phase)) throw Error('Unsupported acceptance phase');
  process.chdir(fileURLToPath(new URL('../../', import.meta.url)));
  const args = process.argv.slice(2);
  if (
    args.some((arg) => arg !== '--session-only' && !(phase === 6 && arg === '--payment-diagnostic'))
  )
    throw new Error('Unknown verification option');
  // Session-only is supplemental evidence; the default includes both execution journeys.
  const selectedTests = args.includes('--session-only')
    ? [`tests/phase${phase}/session.spec.ts`]
    : args.includes('--payment-diagnostic')
      ? ['--grep', 'SA CASH']
      : [];
  const origin = process.env.STAGING_BASE_URL;
  if (
    !origin ||
    !/^https:\/\/naql365-staging-[a-z0-9-]+\.vercel\.app$/.test(origin) ||
    !process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  )
    throw new Error('Verified protected Driver Preview required');
  const release = acquireHostedRun();
  const ledger =
    phase === 7
      ? fileURLToPath(new URL(`../../supabase/.temp/phase7-${randomUUID()}.jsonl`, import.meta.url))
      : null;
  if (ledger) writeFileSync(ledger, '', { flag: 'wx' });
  let previousGuestPolicy;
  const users = [];
  const otherOrg = randomUUID();
  let ref, admin, org;
  let stage = 'staging-allowlist';
  try {
    ref = stagingProject();
    stage = 'catalogue';
    org = query(ref, 'select organization_id from private.customer_enrollment where singleton')[0]
      ?.organization_id;
    if (!org) throw new Error('Staging catalogue unavailable');
    if (phase === 7) {
      previousGuestPolicy =
        query(
          ref,
          `select enabled,lifetime_days,creations_per_hour from private.guest_policy where organization_id='${org}'`,
        )[0] ?? null;
      query(
        ref,
        `insert into private.guest_policy(organization_id,enabled,creations_per_hour) values('${org}',true,100) on conflict(organization_id) do update set enabled=true,creations_per_hour=100`,
      );
    }
    stage = 'api-key-discovery';
    const keys = JSON.parse(
      supabase(['projects', 'api-keys', '--project-ref', ref, '--reveal', '--output', 'json']),
    );
    const adminKey = keys.find((k) => k.type === 'secret')?.api_key,
      publicKey = keys.find((k) => k.type === 'publishable')?.api_key;
    if (!adminKey || !publicKey) throw new Error('Staging keys unavailable');
    const url = `https://${ref}.supabase.co`;
    admin = createClient(url, adminKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    stage = 'isolation-organization';
    query(
      ref,
      `insert into public.organizations(id,name) values('${otherOrg}','Driver isolation fixture');select private.provision_initial_market_catalogue('${otherOrg}');update public.markets set active=true where organization_id='${otherOrg}'`,
    );
    const identities = {};
    for (const label of [
      'customer',
      'sales',
      'operations',
      'peer',
      'other',
      'saDriverA',
      'saDriverB',
      'egDriverA',
      'egDriverB',
      'otherDriver',
      'crossMarketDriver',
      'externalDriver',
      'sessionDriver',
      ...(phase === 5 ? ['isolationDriver'] : []),
      ...(phase >= 6 ? ['finance', 'otherFinance', 'bankAdmin'] : []),
    ]) {
      stage = 'fixture-identity-' + label;
      const email = `naql365-phase${phase}-${label}-${randomUUID()}@example.test`,
        password = randomBytes(32).toString('base64url');
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: 'SUPER_ADMIN' },
      });
      if (created.error || !created.data.user) {
        console.error(
          JSON.stringify({
            fixtureAuthStatus: created.error?.status ?? null,
            fixtureAuthCode:
              created.error?.code && /^[a-z_]{1,80}$/.test(created.error.code)
                ? created.error.code
                : 'unavailable',
          }),
        );
        throw new Error('Fixture identity unavailable');
      }
      const id = created.data.user.id;
      users.push(id);
      identities[label] = { email, password, id };
      if (label !== 'customer') {
        stage = 'fixture-membership-' + label;
        const tenant = ['other', 'otherDriver', 'otherFinance'].includes(label) ? otherOrg : org;
        const type = label === 'peer' ? 'customer' : label.includes('Driver') ? 'driver' : 'staff',
          role =
            label === 'bankAdmin'
              ? 'SUPER_ADMIN'
              : label === 'finance' || label === 'otherFinance'
                ? 'FINANCE'
                : label === 'peer'
                  ? 'CUSTOMER'
                  : label.includes('Driver')
                    ? 'DRIVER'
                    : label === 'sales'
                      ? 'SALES'
                      : 'DISPATCHER';
        query(
          ref,
          `begin;insert into public.organization_memberships(organization_id,profile_id,member_type) values('${tenant}','${id}','${type}');insert into public.user_roles(organization_id,profile_id,role_id) select '${tenant}','${id}',id from public.roles where code='${role}';${label === 'peer' ? `insert into public.customers(organization_id,profile_id) values('${org}','${id}');` : ''}commit;`,
        );
      }
    }
    stage = 'bank-fixtures';
    if (phase >= 6) {
      const count = query(
        ref,
        `select count(*)::integer n from public.bank_accounts where organization_id='${org}' and active and is_primary`,
      )[0]?.n;
      if (count !== 0) throw Error('Existing bank configuration must not be replaced by fixtures');
      query(
        ref,
        `insert into public.bank_accounts(organization_id,market_id,currency,bank_name_ar,bank_name_en,beneficiary_ar,beneficiary_en,account_number,created_by)
        select organization_id,id,currency,'حساب اختبار فقط','STAGING TEST ONLY','مستفيد اختبار','TEST BENEFICIARY','TEST-ONLY-'||country_code,'${identities.bankAdmin.id}' from public.markets where organization_id='${org}' and active`,
      );
      if (phase === 7)
        query(
          ref,
          `update public.bank_accounts set destination_type='VODAFONE_CASH',bank_name_ar='فودافون كاش اختبار',bank_name_en='TEST Vodafone Cash' where created_by='${identities.bankAdmin.id}' and currency='EGP';
        insert into public.bank_accounts(organization_id,market_id,currency,bank_name_ar,bank_name_en,beneficiary_ar,beneficiary_en,account_number,created_by,destination_type,is_primary)
        select organization_id,id,currency,'إنستاباي اختبار','TEST InstaPay','اختبار','TEST ONLY','TEST-INSTAPAY','${identities.bankAdmin.id}','INSTAPAY',false from public.markets where organization_id='${org}' and country_code='EG' and active`,
        );
    }
    stage = 'hosted-browser';
    const code = await new Promise((resolve) => {
      const child = spawn(
        process.execPath,
        [
          'node_modules/@playwright/test/cli.js',
          'test',
          ...selectedTests,
          '--config',
          `playwright.phase${phase}.config.ts`,
        ],
        {
          env: {
            ...process.env,
            STAGING_PHASE4_ORG: org,
            STAGING_PHASE4_OTHER_ORG: otherOrg,
            STAGING_PHASE4_IDENTITIES: JSON.stringify(identities),
            STAGING_TEST_API_URL: url,
            STAGING_TEST_PUBLIC_KEY: publicKey,
            STAGING_TEST_ADMIN_KEY: adminKey,
            ...(ledger ? { STAGING_PHASE7_FIXTURE_LEDGER: ledger } : {}),
          },
          stdio: 'inherit',
        },
      );
      child.on('exit', resolve);
      child.on('error', () => resolve(1));
    });
    if (code !== 0) process.exitCode = 1;
  } catch {
    console.error('Hosted acceptance failed at ' + stage + '; sensitive details withheld');
    process.exitCode = 1;
  } finally {
    try {
      if (ref && admin && users.length) {
        const ids = users.map((id) => `'${id}'`).join(',');
        const guestSelectors = ledger
          ? readFileSync(ledger, 'utf8')
              .split('\n')
              .filter(Boolean)
              .map((line) => {
                const entry = JSON.parse(line);
                if (typeof entry.verifier === 'string' && /^[a-f0-9]{64}$/.test(entry.verifier))
                  return `select request_id as id from private.guest_access_grants where organization_id='${org}' and verifier=decode('${entry.verifier}','hex')`;
                const id = entry.requestId;
                if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id))
                  throw Error('Invalid fixture ledger');
                return `select '${id}'::uuid as id`;
              })
              .join(' union ') || 'select null::uuid as id'
          : 'select null::uuid as id';
        const guestRequests =
          query(ref, guestSelectors)
            .filter((row) => row.id)
            .map((row) => `'${row.id}'`)
            .join(',') || 'NULL';
        const files = query(
          ref,
          `select bucket_id,object_name from public.file_objects where owner_profile_id in (${ids}) or guest_customer_id in(select customer_id from public.requests where organization_id='${org}' and id in (${guestRequests})) union all select 'pod-files',object_name from public.trip_pods where actor_id in (${ids}) union all select 'issue-files',object_name from public.issue_photos where actor_id in (${ids})`,
        );
        for (const f of files) {
          const r = await admin.storage.from(f.bucket_id).remove([f.object_name]);
          if (r.error) throw new Error('Fixture file cleanup failed');
        }
        query(
          ref,
          `begin;set local app.fixture_cleanup='on';
    create temporary table cleanup_requests as select r.id from public.requests r join public.customers c on c.id=r.customer_id where c.profile_id in (${ids}) or (r.organization_id='${org}' and r.id in (${guestRequests}) and c.identity_kind='GUEST');
    create temporary table cleanup_customers as select id from public.customers where profile_id in (${ids}) or id in(select customer_id from public.requests where id in(select id from cleanup_requests));
    create temporary table cleanup_grants as select id from private.guest_access_grants where request_id in(select id from cleanup_requests);
    create temporary table cleanup_quotes as select q.id from public.quotes q where request_id in(select id from cleanup_requests);
    create temporary table cleanup_versions as select id from public.quote_versions where quote_id in(select id from cleanup_quotes);
    create temporary table cleanup_orders as select id from public.orders where request_id in(select id from cleanup_requests);
    create temporary table cleanup_jobs as select id from public.jobs where order_id in(select id from cleanup_orders);
    create temporary table cleanup_trips as select id from public.trips where job_id in(select id from cleanup_jobs);
    create temporary table cleanup_resources as select (result->>'id')::uuid as id,intent->>'action' as action from private.operational_mutations where actor_id in (${ids}) and intent->>'action' in ('create_driver','create_vehicle');
    delete from private.driver_mutations where actor_id in (${ids});
    delete from public.trip_event_locations where trip_id in(select id from cleanup_trips);
    delete from public.issue_photos where issue_id in(select id from public.issues where trip_id in(select id from cleanup_trips));
    delete from public.issues where trip_id in(select id from cleanup_trips);
    delete from public.trip_pods where trip_id in(select id from cleanup_trips);
    delete from public.trip_events where trip_id in(select id from cleanup_trips);
    delete from public.trip_stop_dependencies where trip_id in(select id from cleanup_trips);
    delete from public.trip_stops where trip_id in(select id from cleanup_trips);
    delete from public.assignments where trip_id in(select id from cleanup_trips);
    delete from public.trips where id in(select id from cleanup_trips);delete from public.jobs where id in(select id from cleanup_jobs);
    delete from public.drivers where id in(select id from cleanup_resources where action='create_driver');delete from public.vehicles where id in(select id from cleanup_resources where action='create_vehicle');
    delete from public.notifications where payment_id in(select id from public.payments where order_id in(select id from cleanup_orders));
    delete from public.invoices where order_id in(select id from cleanup_orders);
    delete from public.payment_transactions where payment_id in(select id from public.payments where order_id in(select id from cleanup_orders));
    delete from public.bank_transfer_attempts where payment_id in(select id from public.payments where order_id in(select id from cleanup_orders));
    delete from public.payments where order_id in(select id from cleanup_orders);
    delete from private.payment_mutations where actor_id in (${ids}) or actor_id in(select id from cleanup_grants);
    delete from public.bank_accounts where created_by in (${ids});
    delete from private.operational_mutations where actor_id in (${ids});delete from public.orders where id in(select id from cleanup_orders);
    delete from public.quote_items where quote_version_id in(select id from cleanup_versions);delete from public.quote_pricing_details where quote_version_id in(select id from cleanup_versions);
    delete from public.quote_versions where id in(select id from cleanup_versions);delete from public.quotes where id in(select id from cleanup_quotes);
    delete from public.pricing_evaluation_components where evaluation_id in(select id from public.pricing_evaluations where request_id in(select id from cleanup_requests));
    delete from public.pricing_evaluations where request_id in(select id from cleanup_requests);delete from public.distance_snapshots where request_id in(select id from cleanup_requests);
    delete from public.request_attachments where request_id in(select id from cleanup_requests);delete from public.file_objects where owner_profile_id in (${ids}) or guest_customer_id in(select id from cleanup_customers);
    delete from private.guest_rate_budgets where subject in(select id from cleanup_grants);
    delete from public.audit_logs where entity_id in(select id from cleanup_requests) or metadata->>'guest_grant_id' in(select id::text from cleanup_grants);
    delete from private.guest_access_grants where id in(select id from cleanup_grants);
    delete from public.request_additional_services where request_id in(select id from cleanup_requests);delete from public.request_locations where request_id in(select id from cleanup_requests);delete from public.request_items where request_id in(select id from cleanup_requests);delete from public.requests where id in(select id from cleanup_requests);
    delete from public.customers where id in(select id from cleanup_customers);delete from public.user_roles where profile_id in (${ids});delete from public.organization_memberships where profile_id in (${ids});delete from public.audit_logs where actor_id in (${ids});
    do $$ begin
     if exists(select 1 from public.requests where id in(select id from cleanup_requests)) or exists(select 1 from private.guest_access_grants where id in(select id from cleanup_grants)) or exists(select 1 from public.customers where id in(select id from cleanup_customers)) then raise exception 'Guest fixture cleanup incomplete'; end if;
     if exists(select 1 from public.payments where order_id in(select id from cleanup_orders)) or exists(select 1 from public.invoices where order_id in(select id from cleanup_orders)) or exists(select 1 from public.bank_transfer_attempts where submitted_by in (${ids})) or exists(select 1 from public.bank_accounts where created_by in (${ids})) or exists(select 1 from public.file_objects where owner_profile_id in (${ids})) or exists(select 1 from private.payment_mutations where actor_id in (${ids})) then raise exception 'Financial fixture cleanup incomplete';end if;
    end $$;commit;`,
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
      // Provisioning can fail before the first Auth identity exists. The organization
      // is still owned by this run and must not survive that early failure.
      if (ref && admin && users.length === 0) {
        query(
          ref,
          `begin;delete from public.market_cities where organization_id='${otherOrg}';delete from public.market_regions where organization_id='${otherOrg}';delete from public.markets where organization_id='${otherOrg}';delete from public.audit_logs where organization_id='${otherOrg}';delete from public.organizations where id='${otherOrg}';commit;`,
        );
      }
      console.log('Driver synthetic fixture cleanup PASS; existing catalogues retained');
      if (ledger) unlinkSync(ledger);
    } catch {
      console.error('Driver cleanup incomplete; scoped identifiers withheld');
      process.exitCode = 1;
    } finally {
      try {
        if (phase === 7 && ref && org && previousGuestPolicy !== undefined) {
          if (previousGuestPolicy === null)
            query(ref, `delete from private.guest_policy where organization_id='${org}'`);
          else
            query(
              ref,
              `update private.guest_policy set enabled=${Boolean(previousGuestPolicy.enabled)},lifetime_days=${Number(previousGuestPolicy.lifetime_days)},creations_per_hour=${Number(previousGuestPolicy.creations_per_hour)} where organization_id='${org}'`,
            );
        }
      } catch {
        console.error('Guest policy restoration failed; manual Staging recovery required');
        process.exitCode = 1;
      } finally {
        release();
      }
    }
  }
}

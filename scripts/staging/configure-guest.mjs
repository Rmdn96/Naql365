import { stagingProject, query } from './supabase.mjs';

// Intended Staging configuration, distinct from disposable acceptance fixtures.
const ref = stagingProject();
if (process.argv.slice(2).join(' ') !== '--apply')
  throw Error('Pass --apply to enable the verified Staging guest policy');
const org = query(ref, 'select organization_id from private.customer_enrollment where singleton')[0]
  ?.organization_id;
if (typeof org !== 'string' || !/^[a-f0-9-]{36}$/.test(org))
  throw Error('Existing Staging enrollment required');
query(
  ref,
  `insert into private.guest_policy(organization_id,enabled,lifetime_days,creations_per_hour)
 values('${org}',true,30,30) on conflict(organization_id) do update set enabled=true`,
);
console.log(
  JSON.stringify({
    environment: 'Staging',
    guestCreationEnabled: true,
    existingExpiryAndQuotaPreserved: true,
  }),
);

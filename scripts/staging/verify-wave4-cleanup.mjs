// Independent readback after a completed visual batch. No deletion or mutation.
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { stagingProject, query } from './supabase.mjs';
delete process.env.SUPABASE_ACCESS_TOKEN;
const filename = process.argv[2];
if (!/^wave4-staff-visual-\d+\.json$/.test(filename ?? ''))
  throw Error('EXACT_WAVE4_LEDGER_REQUIRED');
const ledger = JSON.parse(readFileSync(join('supabase/.temp', basename(filename)), 'utf8'));
const { org, run } = ledger;
const directory =
  ledger.ledger.find((row) => row.kind === 'run-meta')?.evidenceDirectory ??
  'docs/reports/evidence/lovable-wave4-staff';
if (!/^docs\/reports\/evidence\/lovable-wave4-staff(?:-final)?$/.test(directory))
  throw Error('OWNED_EVIDENCE_PATH_REQUIRED');
const users = ledger.ledger.filter((row) => row.kind === 'auth').map((row) => row.id);
if (
  !/^[a-f0-9-]{36}$/.test(org) ||
  !users.length ||
  !users.every((id) => /^[a-f0-9-]{36}$/.test(id)) ||
  !ledger.ledger.some((row) => row.kind === 'cleanup' && row.result === 'PASS')
)
  throw Error('COMPLETED_OWNED_LEDGER_REQUIRED');
const ids = users.map((id) => `'${id}'::uuid`).join(',');
const ref = stagingProject();
const remaining = query(
  ref,
  `select
  (select count(*)::int from auth.users where id in (${ids})) auth,
  (select count(*)::int from public.profiles where id in (${ids})) profiles,
  (select count(*)::int from public.organization_memberships where profile_id in (${ids})) memberships,
  (select count(*)::int from public.user_roles where profile_id in (${ids})) roles,
  (select count(*)::int from public.customers where profile_id in (${ids}) or organization_id='${org}') customers,
  (select count(*)::int from public.organizations where id='${org}') organizations,
  (select count(*)::int from public.requests where organization_id='${org}') requests,
  (select count(*)::int from public.quotes where organization_id='${org}') quotes,
  (select count(*)::int from public.quote_versions where organization_id='${org}') quote_versions,
  (select count(*)::int from public.orders where organization_id='${org}') orders,
  (select count(*)::int from public.jobs where organization_id='${org}') jobs,
  (select count(*)::int from public.trips where organization_id='${org}') trips,
  (select count(*)::int from public.bank_accounts where organization_id='${org}') banks,
  (select count(*)::int from public.file_objects where organization_id='${org}') files,
  (select count(*)::int from storage.objects where name like '${org}/%') storage`,
)[0];
if (!remaining || Object.values(remaining).some((value) => value !== 0))
  throw Error('INDEPENDENT_CLEANUP_NOT_ZERO');
const proof = {
  run,
  result: 'PASS',
  ownedIdentities: users.length,
  remaining,
  baselinePreservation:
    'The batch independently compared its before/after non-owned catalogue/configuration/grants fingerprint.',
  verifiedAt: new Date().toISOString(),
};
writeFileSync(`${directory}/cleanup-${run}.json`, JSON.stringify(proof, null, 2) + '\n');
console.log(JSON.stringify(proof));

// Operator-only Wave 5 orchestration. No application import or credential output.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { acceptanceTarget, protectionHeaders } from './target.mjs';
import { stagingProject, query } from './supabase.mjs';
import { verifyDriverAcceptance } from './verify-driver.mjs';
import { driverLoadingMarkup } from '../../tests/helpers/driver-v2-loading.mjs';

if (process.env.ACCEPTANCE_OIDC_ENV_FILE)
  process.env.VERCEL_OIDC_TOKEN = parseEnv(
    readFileSync(process.env.ACCEPTANCE_OIDC_ENV_FILE, 'utf8'),
  ).VERCEL_OIDC_TOKEN;
delete process.env.SUPABASE_ACCESS_TOKEN; // Use the owner's refreshed normal CLI credential, not a stale inherited token.
const { origin } = acceptanceTarget();
if (!driverLoadingMarkup('TEST ONLY').includes('class="skeleton"'))
  throw Error('WAVE5_LOADING_RENDERER_PREFLIGHT_FAILED');
if (origin !== 'https://naql365-staging-ui-v2-naql365.vercel.app')
  throw Error('WAVE5_CANONICAL_REQUIRED');
const directory = process.env.STAGING_WAVE5_RUN_DIR;
if (
  !/^supabase\/\.temp\/wave5-hosted-[a-z0-9-]+$/.test(directory ?? '') ||
  !/^[a-f0-9]{40}$/.test(process.env.ACCEPTANCE_APPLICATION_SHA ?? '')
)
  throw Error('WAVE5_IDENTITY_REQUIRED');
const ref = stagingProject();
const response = await fetch(origin + '/en/login', {
  headers: protectionHeaders(),
  redirect: 'manual',
  signal: AbortSignal.timeout(20000),
});
if (response.status !== 200) throw Error('WAVE5_PROTECTED_PREFLIGHT_FAILED');
mkdirSync(directory, { recursive: true });
const baseline = query(
  ref,
  `select gp.organization_id,gp.enabled,gp.lifetime_days,gp.creations_per_hour from private.guest_policy gp join private.customer_enrollment ce on ce.organization_id=gp.organization_id where ce.singleton`,
);
writeFileSync(directory + '/policy-baseline.json', JSON.stringify(baseline));
const track = () => {
  for (const name of readdirSync('supabase/.temp').filter((x) =>
    /^acceptance-.*\.jsonl$/.test(x),
  )) {
    const content = readFileSync('supabase/.temp/' + name, 'utf8');
    if (JSON.parse(content.split('\n')[0]).pid === process.pid)
      writeFileSync(directory + '/run-owned.jsonl', content);
  }
};
const timer = setInterval(track, 1000);
try {
  // Existing real Driver suite, including session revocation; no replacement commands.
  if (process.argv.slice(2).length) throw Error('WAVE5_NO_EXTRA_ARGS');
  const phase = Number(process.env.WAVE5_DRIVER_ACCEPTANCE_PHASE ?? 4);
  if (![4, 5].includes(phase)) throw Error('WAVE5_DRIVER_PHASE_DENIED');
  await verifyDriverAcceptance(phase);
} finally {
  clearInterval(timer);
  const ledgerPath = directory + '/run-owned.jsonl';
  if (existsSync(ledgerPath)) {
    const ledger = readFileSync(ledgerPath, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((x) => JSON.parse(x));
    const users = ledger.filter((x) => x.kind === 'auth').map((x) => x.id);
    const orgs = ledger.filter((x) => x.kind === 'organization').map((x) => x.id);
    if (![...users, ...orgs].every((x) => /^[a-f0-9-]{36}$/.test(x)))
      throw Error('WAVE5_LEDGER_INVALID');
    const ids = users.length ? users.map((x) => `'${x}'::uuid`).join(',') : 'NULL';
    const organizations = orgs.length ? orgs.map((x) => `'${x}'::uuid`).join(',') : 'NULL';
    const remaining = query(
      ref,
      `select (select count(*)::int from auth.users where id in (${ids})) auth_identities,(select count(*)::int from public.profiles where id in (${ids})) profiles,(select count(*)::int from public.organization_memberships where profile_id in (${ids})) memberships,(select count(*)::int from public.user_roles where profile_id in (${ids})) roles,(select count(*)::int from public.customers where profile_id in (${ids})) customers,(select count(*)::int from public.bank_accounts where created_by in (${ids})) bank_fixtures,(select count(*)::int from public.file_objects where owner_profile_id in (${ids})) files,(select count(*)::int from public.organizations where id in (${organizations})) isolated_organizations`,
    );
    const restored = query(
      ref,
      `select gp.organization_id,gp.enabled,gp.lifetime_days,gp.creations_per_hour from private.guest_policy gp join private.customer_enrollment ce on ce.organization_id=gp.organization_id where ce.singleton`,
    );
    const cleanup =
      remaining.length === 1 &&
      Object.values(remaining[0]).every((x) => x === 0) &&
      JSON.stringify(restored) === JSON.stringify(baseline);
    writeFileSync(
      directory + '/cleanup.json',
      JSON.stringify(
        {
          result: cleanup ? 'PASS' : 'FAIL',
          ownedIdentities: users.length,
          remaining: remaining[0],
          guestPolicyRestored: JSON.stringify(restored) === JSON.stringify(baseline),
          verifiedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    if (!cleanup) throw Error('WAVE5_INDEPENDENT_CLEANUP_FAILED');
    console.log('Wave 5 independent identity/configuration cleanup PASS');
  }
}

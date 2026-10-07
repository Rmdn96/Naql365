import { readFileSync } from 'node:fs';
const manifest = JSON.parse(
  readFileSync(new URL('../../config/deployment-manifest.json', import.meta.url), 'utf8'),
);
export function acceptanceTarget(env = process.env, approved = manifest) {
  const origin = env.STAGING_BASE_URL;
  const provider = env.ACCEPTANCE_PROVIDER || 'VERCEL_STAGING';
  if (env.APP_ENV !== 'staging' || env.STAGING_SUPABASE_PROJECT_REF !== approved.staging.projectRef)
    throw Error('ACCEPTANCE_ENVIRONMENT_DENIED');
  let url;
  try {
    url = new URL(origin);
  } catch {
    throw Error('ACCEPTANCE_ORIGIN_DENIED');
  }
  if (url.protocol !== 'https:' || url.origin !== origin || url.username || url.password)
    throw Error('ACCEPTANCE_ORIGIN_DENIED');
  if (provider === 'VERCEL_STAGING') {
    if (!approved.staging.origins.includes(origin) || !env.VERCEL_AUTOMATION_BYPASS_SECRET)
      throw Error('ACCEPTANCE_PROTECTION_REQUIRED');
  } else if (provider === 'HOSTINGER_ACCEPTANCE') {
    // Exact entries may be added only after platform access restriction is independently verified.
    if (
      !approved.staging.hostingerOrigins.includes(origin) ||
      approved.staging.hostingerProtection?.[origin]?.mode !== 'NETWORK_ALLOWLIST' ||
      !approved.staging.hostingerProtection?.[origin]?.approval
    )
      throw Error('ACCEPTANCE_HOSTINGER_NOT_APPROVED');
  } else throw Error('ACCEPTANCE_PROVIDER_DENIED');
  return { origin, provider };
}
export function protectionHeaders(env = process.env, approved = manifest) {
  const target = acceptanceTarget(env, approved);
  return target.provider === 'VERCEL_STAGING'
    ? { 'x-vercel-protection-bypass': env.VERCEL_AUTOMATION_BYPASS_SECRET }
    : {};
}

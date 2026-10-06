import { createHash } from 'node:crypto';

export type Manifest = {
  version: number;
  staging: {
    projectRef: string;
    origins: string[];
    hostingerOrigins: string[];
    hostingerProtection?: Record<string, { mode: string; approval: string }>;
  };
  production: null | {
    projectRef: string;
    publicKeyDigest: string;
    identity: string;
    revision: string;
  };
};
type Inputs = Record<string, string | undefined>;
export type ArtifactIdentity = {
  environment: string;
  origin: string;
  backend: string;
  publicKeyDigest: string;
  manifestDigest: string;
};
function fail(code: string): never {
  throw new Error(code);
}
export function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
export function validateEnvironment(env: Inputs, manifest: Manifest): ArtifactIdentity {
  const environment = env.APP_ENV || 'local';
  if (!['local', 'staging', 'production'].includes(environment)) fail('ENV_INVALID');
  if (env.VERCEL_ENV === 'preview' && environment !== 'staging') fail('ENV_PLATFORM_MISMATCH');
  if (env.VERCEL_ENV === 'production' && environment !== 'production')
    fail('ENV_PLATFORM_MISMATCH');
  const origin = env.APP_URL || '';
  const backend = env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
  const identity = {
    environment,
    origin,
    backend,
    publicKeyDigest: digest(key),
    manifestDigest: digest(JSON.stringify(manifest)),
  };
  if (environment === 'local') return identity;
  if (manifest.version !== 1) fail('ENV_MANIFEST_INVALID');
  if (environment === 'production') {
    if (origin !== 'https://naql365.com') fail('ENV_CANONICAL_ORIGIN_MISMATCH');
    if (env.STAGING_AUTH_SMOKE_ENABLED && env.STAGING_AUTH_SMOKE_ENABLED !== 'false')
      fail('ENV_STAGING_SMOKE_IN_PRODUCTION');
    if (backend === `https://${manifest.staging.projectRef}.supabase.co`)
      fail('ENV_STAGING_BACKEND_IN_PRODUCTION');
    if (!manifest.production) fail('ENV_PRODUCTION_NOT_APPROVED');
    if (
      backend !== `https://${manifest.production.projectRef}.supabase.co` ||
      digest(key) !== manifest.production.publicKeyDigest
    )
      fail('ENV_BACKEND_IDENTITY_MISMATCH');
  } else {
    if (![...manifest.staging.origins, ...manifest.staging.hostingerOrigins].includes(origin))
      fail('ENV_STAGING_ORIGIN_NOT_APPROVED');
    if (backend !== `https://${manifest.staging.projectRef}.supabase.co`)
      fail('ENV_BACKEND_IDENTITY_MISMATCH');
  }
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return fail('ENV_CANONICAL_ORIGIN_MISMATCH');
  }
  if (url.protocol !== 'https:' || url.origin !== origin || url.username || url.password)
    fail('ENV_CANONICAL_ORIGIN_MISMATCH');
  if (!/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(key)) fail('ENV_PUBLIC_KEY_INVALID');
  return identity;
}
export function verifyArtifact(build: ArtifactIdentity, runtime: ArtifactIdentity) {
  for (const field of [
    'environment',
    'origin',
    'backend',
    'publicKeyDigest',
    'manifestDigest',
  ] as const) {
    if (build[field] !== runtime[field]) fail('ENV_BUILD_RUNTIME_MISMATCH');
  }
}
export async function attestBackend(
  env: Inputs,
  manifest: Manifest,
  fetcher: typeof fetch = fetch,
  timeoutMs = 5000,
) {
  const config = validateEnvironment(env, manifest);
  if (config.environment !== 'production') return;
  const expected = manifest.production!;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      (async () => {
        const response = await fetcher(`${config.backend}/rest/v1/rpc/deployment_attestation`, {
          method: 'POST',
          headers: {
            apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
            'Content-Type': 'application/json',
          },
          body: '{}',
          redirect: 'error',
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok || !response.body) fail('ENV_BACKEND_ATTESTATION_UNAVAILABLE');
        const reader = response.body.getReader();
        let text = '';
        let bytes = 0;
        const decoder = new TextDecoder();
        try {
          for (;;) {
            const chunk = await reader.read();
            if (chunk.done) break;
            bytes += chunk.value.byteLength;
            if (bytes > 2048) fail('ENV_BACKEND_ATTESTATION_UNAVAILABLE');
            text += decoder.decode(chunk.value, { stream: true });
          }
        } finally {
          await reader.cancel();
        }
        const rows = JSON.parse(text);
        const row = Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
        if (
          !row ||
          Object.keys(row).sort().join(',') !==
            'configuration_revision,deployment_identity,environment,protocol_version' ||
          row.protocol_version !== 1 ||
          row.environment !== 'production' ||
          row.deployment_identity !== expected.identity ||
          row.configuration_revision !== expected.revision
        )
          fail('ENV_BACKEND_ATTESTATION_UNAVAILABLE');
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error('ENV_BACKEND_ATTESTATION_UNAVAILABLE'));
        }, timeoutMs);
      }),
    ]);
  } catch {
    fail('ENV_BACKEND_ATTESTATION_UNAVAILABLE');
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

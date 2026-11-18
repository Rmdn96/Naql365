import { expect, it } from 'vitest';
import manifest from '../../config/deployment-manifest.json';
import {
  attestBackend,
  digest,
  validateEnvironment,
  verifyArtifact,
} from '../../src/infrastructure/config/environment-authority';
import { assertSameOrigin } from '../../src/application/identity/smoke-auth';
const origin = 'https://purple-skunk-677919.hostingersite.com';
const key = 'sb_publishable_synthetic_configuration_only_123';
const env = {
  APP_ENV: 'production',
  APP_URL: origin,
  NEXT_PUBLIC_SUPABASE_URL: 'https://suozeqelwmhjlptzaqsk.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
};
const release = {
  ...manifest,
  production: {
    origin,
    sourceCommit: '1'.repeat(40),
    projectRef: 'suozeqelwmhjlptzaqsk',
    publicKeyDigest: digest(key),
    identity: 'synthetic-existing-identity',
    revision: 'synthetic-existing-revision',
  },
};
it('requires an independently issued manifest for the exact Production Hostinger origin', () => {
  expect(() => validateEnvironment(env, manifest)).toThrow('ENV_PRODUCTION_NOT_APPROVED');
  expect(validateEnvironment(env, release).origin).toBe(origin);
  for (const APP_URL of [
    'https://other.hostingersite.com',
    `${origin}/`,
    `${origin}.evil.test`,
    'https://naql365-launch.vercel.app',
  ])
    expect(() => validateEnvironment({ ...env, APP_URL }, release)).toThrow();
  for (const changes of [
    { APP_ENV: 'staging' },
    { NEXT_PUBLIC_SUPABASE_URL: 'https://zuvyfeflkzlciuaauxba.supabase.co' },
    { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: `${key}wrong` },
  ])
    expect(() => validateEnvironment({ ...env, ...changes }, release)).toThrow();
});
it('preserves CSRF and build/runtime identity checks', () => {
  expect(() => assertSameOrigin(origin, origin)).not.toThrow();
  expect(() => assertSameOrigin('https://naql365-launch.vercel.app', origin)).toThrow();
  const build = validateEnvironment(env, release);
  expect(() =>
    verifyArtifact(build, { ...build, origin: 'https://naql365-launch.vercel.app' }),
  ).toThrow('ENV_BUILD_RUNTIME_MISMATCH');
});
it('requires existing backend attestation and rejects missing or mismatched identity', async () => {
  const tuple = {
    protocol_version: 1,
    environment: 'production',
    deployment_identity: release.production.identity,
    configuration_revision: release.production.revision,
  };
  await expect(
    attestBackend(env, release, async () => Response.json([tuple])),
  ).resolves.toBeUndefined();
  for (const rows of [
    [],
    [{ ...tuple, deployment_identity: 'wrong' }],
    [{ ...tuple, configuration_revision: 'wrong' }],
  ])
    await expect(attestBackend(env, release, async () => Response.json(rows))).rejects.toThrow(
      'ENV_BACKEND_ATTESTATION_UNAVAILABLE',
    );
});

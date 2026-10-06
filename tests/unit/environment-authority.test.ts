import { describe, expect, it } from 'vitest';
import {
  attestBackend,
  digest,
  validateEnvironment,
  verifyArtifact,
  type Manifest,
} from '../../src/infrastructure/config/environment-authority';
import { acceptanceTarget } from '../../scripts/staging/target.mjs';
const key = 'sb_publishable_synthetic_configuration_only_123';
const manifest: Manifest = {
  version: 1,
  staging: {
    projectRef: 'stagingfixture',
    origins: ['https://approved.vercel.app'],
    hostingerOrigins: ['https://approved.example.test'],
    hostingerProtection: {
      'https://approved.example.test': {
        mode: 'NETWORK_ALLOWLIST',
        approval: 'synthetic-test-only',
      },
    },
  },
  production: {
    projectRef: 'productionfixture',
    publicKeyDigest: digest(key),
    identity: 'identity',
    revision: 'revision',
  },
};
const safe = {
  APP_ENV: 'production',
  APP_URL: 'https://naql365.com',
  NEXT_PUBLIC_SUPABASE_URL: 'https://productionfixture.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
};
describe('independently approved deployment authority', () => {
  it.each([
    'http://localhost:3000',
    'https://127.0.0.1',
    'https://x.vercel.app',
    'https://temporary.hostinger.example',
    'https://www.naql365.com',
    '',
  ])('rejects production origin %s', (APP_URL) => {
    expect(() => validateEnvironment({ ...safe, APP_URL }, manifest)).toThrow(
      'ENV_CANONICAL_ORIGIN_MISMATCH',
    );
  });
  it('rejects staging backend in production', () =>
    expect(() =>
      validateEnvironment(
        { ...safe, NEXT_PUBLIC_SUPABASE_URL: 'https://stagingfixture.supabase.co' },
        manifest,
      ),
    ).toThrow('ENV_STAGING_BACKEND_IN_PRODUCTION'));
  it('rejects absent approval and enabled smoke', () => {
    expect(() => validateEnvironment(safe, { ...manifest, production: null })).toThrow(
      'ENV_PRODUCTION_NOT_APPROVED',
    );
    expect(() =>
      validateEnvironment({ ...safe, STAGING_AUTH_SMOKE_ENABLED: 'true' }, manifest),
    ).toThrow('ENV_STAGING_SMOKE_IN_PRODUCTION');
  });
  it('rejects mismatched key and runtime artifact', () => {
    expect(() =>
      validateEnvironment({ ...safe, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key + 'x' }, manifest),
    ).toThrow('ENV_BACKEND_IDENTITY_MISMATCH');
    const build = validateEnvironment(safe, manifest);
    expect(() => verifyArtifact(build, { ...build, backend: 'different' })).toThrow(
      'ENV_BUILD_RUNTIME_MISMATCH',
    );
    expect(() => verifyArtifact(build, { ...build, publicKeyDigest: 'different' })).toThrow();
    expect(() => verifyArtifact(build, build)).not.toThrow();
  });
  it('accepts local and exact staging, rejects arbitrary origin/backend', () => {
    expect(validateEnvironment({}, manifest).environment).toBe('local');
    const staging = {
      ...safe,
      APP_ENV: 'staging',
      APP_URL: 'https://approved.example.test',
      NEXT_PUBLIC_SUPABASE_URL: 'https://stagingfixture.supabase.co',
    };
    expect(validateEnvironment(staging, manifest).environment).toBe('staging');
    expect(() =>
      validateEnvironment({ ...staging, APP_URL: 'https://arbitrary.example.test' }, manifest),
    ).toThrow();
    expect(() =>
      validateEnvironment(
        { ...staging, NEXT_PUBLIC_SUPABASE_URL: safe.NEXT_PUBLIC_SUPABASE_URL },
        manifest,
      ),
    ).toThrow();
  });
  const row = {
    protocol_version: 1,
    environment: 'production',
    deployment_identity: 'identity',
    configuration_revision: 'revision',
  };
  it('accepts only the exact bounded attestation tuple', async () => {
    await expect(
      attestBackend(safe, manifest, async () => Response.json([row])),
    ).resolves.toBeUndefined();
  });
  it.each(
    [
      [],
      [{ ...row, environment: 'staging' }],
      [{ ...row, deployment_identity: 'wrong' }],
      [{ ...row, configuration_revision: 'wrong' }],
      [{ ...row, private_data: 'forbidden' }],
    ].map((body) => [body]),
  )('rejects unprovisioned/mismatched/unexpected attestation %j', async (body) => {
    await expect(attestBackend(safe, manifest, async () => Response.json(body))).rejects.toThrow(
      'ENV_BACKEND_ATTESTATION_UNAVAILABLE',
    );
  });
  it('rejects missing RPC, network failure, oversized body and timeout', async () => {
    for (const response of [
      async () => new Response('', { status: 404 }),
      async () => {
        throw Error('sensitive transport detail');
      },
      async () => new Response('x'.repeat(3000)),
    ])
      await expect(attestBackend(safe, manifest, response)).rejects.toThrow(
        'ENV_BACKEND_ATTESTATION_UNAVAILABLE',
      );
    await expect(attestBackend(safe, manifest, () => new Promise(() => {}), 5)).rejects.toThrow(
      'ENV_BACKEND_ATTESTATION_UNAVAILABLE',
    );
  });
  it('separates exact Hostinger acceptance from Vercel credentials', () => {
    const env = {
      APP_ENV: 'staging',
      STAGING_SUPABASE_PROJECT_REF: 'stagingfixture',
      STAGING_BASE_URL: 'https://approved.example.test',
      ACCEPTANCE_PROVIDER: 'HOSTINGER_ACCEPTANCE',
    };
    expect(acceptanceTarget(env, manifest).provider).toBe('HOSTINGER_ACCEPTANCE');
    expect(() =>
      acceptanceTarget({ ...env, STAGING_BASE_URL: 'https://other.example.test' }, manifest),
    ).toThrow();
    expect(() => acceptanceTarget({ ...env, APP_ENV: 'production' }, manifest)).toThrow();
    expect(() =>
      acceptanceTarget({ ...env, ACCEPTANCE_PROVIDER: 'VERCEL_STAGING' }, manifest),
    ).toThrow();
  });
});

import { describe, expect, it } from 'vitest';
import {
  attestBackend,
  digest,
  validateEnvironment,
  verifyArtifact,
  verifyProductionSource,
  type Manifest,
} from '../../src/infrastructure/config/environment-authority';
import { acceptanceTarget, protectionHeaders } from '../../scripts/staging/target.mjs';
import { assertSameOrigin } from '../../src/application/identity/smoke-auth';
const key = 'sb_publishable_synthetic_configuration_only_123';
const manifest: Manifest = {
  version: 1,
  productionOrigins: ['https://naql365-launch.vercel.app', 'https://naql365.com'],
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
    origin: 'https://naql365.com',
    sourceCommit: '1'.repeat(40),
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
  it.each(['https://naql365-launch.vercel.app', 'https://naql365.com'])(
    'keeps CSRF exact-origin enforcement for %s',
    (origin) => {
      expect(() => assertSameOrigin(origin, origin)).not.toThrow();
      for (const other of [
        null,
        'https://approved.vercel.app',
        'https://evil.example',
        'https://launch.naql365.com',
        origin === 'https://naql365.com'
          ? 'https://naql365-launch.vercel.app'
          : 'https://naql365.com',
      ])
        expect(() => assertSameOrigin(other, origin)).toThrow();
    },
  );
  it('requires separate manifest approval for the temporary or final origin', () => {
    const temporary = {
      ...manifest,
      production: { ...manifest.production!, origin: 'https://naql365-launch.vercel.app' },
    };
    expect(
      validateEnvironment({ ...safe, APP_URL: temporary.production.origin }, temporary).origin,
    ).toBe(temporary.production.origin);
    expect(validateEnvironment(safe, manifest).origin).toBe(safe.APP_URL);
    expect(() =>
      validateEnvironment({ ...safe, APP_URL: temporary.production.origin }, manifest),
    ).toThrow('ENV_CANONICAL_ORIGIN_MISMATCH');
    expect(() => validateEnvironment(safe, temporary)).toThrow('ENV_CANONICAL_ORIGIN_MISMATCH');
    for (const origin of [
      'https://approved.vercel.app',
      'https://evil.example',
      'https://launch.naql365.com',
      'https://naql365-launch.vercel.app.evil.example',
    ]) {
      expect(() =>
        validateEnvironment(
          { ...safe, APP_URL: origin },
          { ...temporary, production: { ...temporary.production, origin } },
        ),
      ).toThrow('ENV_CANONICAL_ORIGIN_MISMATCH');
    }
  });
  it('binds approval and the runtime artifact to the actual release commit', () => {
    expect(() => verifyProductionSource(manifest, '1'.repeat(40))).not.toThrow();
    for (const commit of ['', '2'.repeat(40), 'not-a-commit'])
      expect(() => verifyProductionSource(manifest, commit)).toThrow('ENV_SOURCE_NOT_APPROVED');
    expect(() =>
      validateEnvironment(safe, {
        ...manifest,
        production: { ...manifest.production!, sourceCommit: '' },
      }),
    ).toThrow('ENV_SOURCE_NOT_APPROVED');
    const build = validateEnvironment(safe, manifest);
    expect(() => verifyArtifact(build, { ...build, sourceCommit: '2'.repeat(40) })).toThrow(
      'ENV_BUILD_RUNTIME_MISMATCH',
    );
    expect(() =>
      verifyArtifact(
        build,
        validateEnvironment(
          { ...safe, APP_URL: 'https://naql365-launch.vercel.app' },
          {
            ...manifest,
            production: { ...manifest.production!, origin: 'https://naql365-launch.vercel.app' },
          },
        ),
      ),
    ).toThrow('ENV_BUILD_RUNTIME_MISMATCH');
  });
  it('does not let public targets use the local environment exception', () => {
    expect(() => validateEnvironment({ APP_URL: 'https://naql365.com' }, manifest)).toThrow(
      'ENV_CANONICAL_ORIGIN_MISMATCH',
    );
    expect(() =>
      validateEnvironment({ APP_ENV: 'local', APP_URL: 'https://approved.example.test' }, manifest),
    ).toThrow('ENV_CANONICAL_ORIGIN_MISMATCH');
    expect(validateEnvironment({ APP_URL: 'http://127.0.0.1:3000' }, manifest).environment).toBe(
      'local',
    );
  });
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
  it('supports short-lived Vercel OIDC without weakening origin, project or environment gates', () => {
    const approved = {
      staging: {
        projectRef: 'synthetic-project',
        origins: ['https://approved.example.test'],
        hostingerOrigins: [],
      },
    };
    const env = {
      APP_ENV: 'staging',
      STAGING_SUPABASE_PROJECT_REF: 'synthetic-project',
      STAGING_BASE_URL: 'https://approved.example.test',
      VERCEL_OIDC_TOKEN: 'synthetic-oidc-only',
    };
    expect(protectionHeaders(env, approved)).toEqual({
      'x-vercel-trusted-oidc-idp-token': 'synthetic-oidc-only',
    });
    expect(() =>
      acceptanceTarget({ ...env, STAGING_BASE_URL: 'https://other.example.test' }, approved),
    ).toThrow();
    expect(() => acceptanceTarget({ ...env, APP_ENV: 'production' }, approved)).toThrow();
    expect(() =>
      acceptanceTarget({ ...env, STAGING_SUPABASE_PROJECT_REF: 'other-project' }, approved),
    ).toThrow();
    expect(() => acceptanceTarget({ ...env, VERCEL_OIDC_TOKEN: undefined }, approved)).toThrow();
  });
  it('separates exact Hostinger acceptance from Vercel credentials', () => {
    const env = {
      APP_ENV: 'staging',
      STAGING_SUPABASE_PROJECT_REF: 'stagingfixture',
      STAGING_BASE_URL: 'https://approved.example.test',
      ACCEPTANCE_PROVIDER: 'HOSTINGER_ACCEPTANCE',
    };
    expect(acceptanceTarget(env, manifest).provider).toBe('HOSTINGER_ACCEPTANCE');
    expect(
      protectionHeaders(
        { ...env, VERCEL_AUTOMATION_BYPASS_SECRET: 'synthetic-not-a-credential' },
        manifest,
      ),
    ).toEqual({});
    expect(() =>
      acceptanceTarget(env, {
        ...manifest,
        staging: { ...manifest.staging, hostingerProtection: {} },
      }),
    ).toThrow('ACCEPTANCE_HOSTINGER_NOT_APPROVED');
    expect(() =>
      acceptanceTarget({ ...env, STAGING_BASE_URL: 'https://other.example.test' }, manifest),
    ).toThrow();
    expect(() => acceptanceTarget({ ...env, APP_ENV: 'production' }, manifest)).toThrow();
    expect(() =>
      acceptanceTarget({ ...env, ACCEPTANCE_PROVIDER: 'VERCEL_STAGING' }, manifest),
    ).toThrow();
  });
});

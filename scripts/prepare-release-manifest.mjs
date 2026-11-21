import { createHash } from 'node:crypto';
import { verifyBuildSource } from './verify-build-source.mjs';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateEnvironment } from '../src/infrastructure/config/environment-authority.ts';

// Build-only transport for an independently issued, reviewed manifest. Never logs its input.
export function prepareReleaseManifest(env = process.env, root = process.cwd()) {
  const encoded = env.NAQL365_RELEASE_MANIFEST_BASE64;
  const expected = env.NAQL365_RELEASE_MANIFEST_SHA256;
  // Preserve local builds and Vercel releases with an already issued manifest.
  // The unchanged guarded build still rejects production:null in Production.
  if (encoded === undefined && expected === undefined) return;
  const fail = () => {
    throw new Error('ENV_RELEASE_MANIFEST_INVALID');
  };
  if (
    env.APP_ENV !== 'production' ||
    typeof encoded !== 'string' ||
    encoded.length === 0 ||
    encoded.length > 32768 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) ||
    !/^[a-f0-9]{64}$/.test(expected || '')
  )
    fail();
  const bytes = Buffer.from(encoded, 'base64');
  if (
    bytes.toString('base64') !== encoded ||
    createHash('sha256').update(bytes).digest('hex') !== expected
  )
    fail();
  let manifest;
  try {
    manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    fail();
  }
  validateEnvironment(env, manifest);
  const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  if (!uuid.test(manifest.production.identity) || !uuid.test(manifest.production.revision)) fail();
  verifyBuildSource(manifest, root, true);
  // Install the manifest only after digest, environment and source verification.
  writeFileSync(resolve(root, 'config/deployment-manifest.json'), bytes);
  return true;
}

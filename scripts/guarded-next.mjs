import { createRequire } from 'node:module';
const { loadEnvConfig } = createRequire(import.meta.url)('@next/env');
loadEnvConfig(process.cwd());
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  validateEnvironment,
  verifyArtifact,
  attestBackend,
} from '../src/infrastructure/config/environment-authority.ts';
const manifest = JSON.parse(
  readFileSync(new URL('../config/deployment-manifest.json', import.meta.url)),
);
const command = process.argv[2];
if (!['build', 'start'].includes(command)) throw Error('ENV_COMMAND_INVALID');
try {
  const current = validateEnvironment(process.env, manifest);
  if (command === 'start') {
    verifyArtifact(JSON.parse(readFileSync('.naql365-build-identity.json', 'utf8')), current);
    await attestBackend(process.env, manifest);
  }
  if (command === 'build') writeFileSync('.naql365-build-identity.json', JSON.stringify(current));
  const result = spawnSync(
    process.execPath,
    ['node_modules/next/dist/bin/next', command, ...process.argv.slice(3)],
    { stdio: 'inherit', env: process.env },
  );
  if (result.status !== 0) process.exit(result.status || 1);
  if (command === 'build') writeFileSync('.naql365-build-identity.json', JSON.stringify(current));
} catch (error) {
  console.error(
    error instanceof Error && /^ENV_[A-Z_]+$/.test(error.message)
      ? error.message
      : 'ENV_PREFLIGHT_FAILED',
  );
  process.exit(1);
}

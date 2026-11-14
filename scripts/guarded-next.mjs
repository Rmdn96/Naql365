import { createRequire } from 'node:module';
const { loadEnvConfig } = createRequire(import.meta.url)('@next/env');
loadEnvConfig(process.cwd());
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  validateEnvironment,
  verifyArtifact,
  attestBackend,
  verifyProductionSource,
} from '../src/infrastructure/config/environment-authority.ts';
const manifest = JSON.parse(
  readFileSync(new URL('../config/deployment-manifest.json', import.meta.url)),
);
const command = process.argv[2];
if (!['build', 'start'].includes(command)) throw Error('ENV_COMMAND_INVALID');
try {
  const current = validateEnvironment(process.env, manifest);
  if (command === 'build' && current.environment === 'production') {
    const head = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
    if (head.status !== 0) throw Error('ENV_SOURCE_NOT_APPROVED');
    verifyProductionSource(manifest, head.stdout.trim());
    // A release manifest is issued after the final commit, before compilation.
    const changed = spawnSync(
      'git',
      ['diff', '--name-only', 'HEAD', '--', '.', ':!config/deployment-manifest.json'],
      { encoding: 'utf8' },
    );
    if (changed.status !== 0 || changed.stdout.trim()) throw Error('ENV_SOURCE_NOT_APPROVED');
    const untracked = spawnSync('git', ['ls-files', '--others', '--exclude-standard'], {
      encoding: 'utf8',
    });
    if (untracked.status !== 0 || untracked.stdout.trim()) throw Error('ENV_SOURCE_NOT_APPROVED');
  }
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

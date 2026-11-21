import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { prepareReleaseManifest } from '../../scripts/prepare-release-manifest.mjs';
import approved from '../../config/deployment-manifest.json';
let root: string;
let source: string;
const original = JSON.stringify(approved);
const key = 'sb_publishable_synthetic_configuration_only_123';
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const env = {
  APP_ENV: 'production',
  APP_URL: 'https://purple-skunk-677919.hostingersite.com',
  NEXT_PUBLIC_SUPABASE_URL: 'https://suozeqelwmhjlptzaqsk.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
};
const target = () => join(root, 'config/deployment-manifest.json');
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'naql365-manifest-'));
  mkdirSync(join(root, 'config'));
  writeFileSync(target(), original);
  writeFileSync(join(root, 'package-lock.json'), '{}');
  writeFileSync(join(root, 'next.config.ts'), 'export default {};');
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git('init');
  git('add', '.');
  git(
    '-c',
    'user.name=Local fixture',
    '-c',
    'user.email=fixture@example.invalid',
    'commit',
    '-m',
    'local fixture',
  );
  source = git('rev-parse', 'HEAD').trim();
});
beforeEach(() => writeFileSync(target(), original));
afterAll(() => rmSync(root, { recursive: true, force: true }));
function inputs(changes = {}) {
  const manifest = {
    ...approved,
    production: {
      origin: env.APP_URL,
      sourceCommit: source,
      projectRef: 'suozeqelwmhjlptzaqsk',
      publicKeyDigest: digest(key),
      identity: 'b726ed83-87c9-4875-a646-cc8f90980cc3',
      revision: '6a325ae6-a223-4ba7-930b-1442b0a04802',
      ...changes,
    },
  };
  const text = JSON.stringify(manifest);
  return {
    ...env,
    NAQL365_RELEASE_MANIFEST_BASE64: Buffer.from(text).toString('base64'),
    NAQL365_RELEASE_MANIFEST_SHA256: digest(text),
  };
}
it('installs reviewed bytes only after digest, actual HEAD and environment match', () => {
  const input = inputs();
  prepareReleaseManifest(input, root);
  expect(readFileSync(target(), 'utf8')).toBe(
    Buffer.from(input.NAQL365_RELEASE_MANIFEST_BASE64, 'base64').toString(),
  );
});
it.each([
  () => ({ ...inputs(), NAQL365_RELEASE_MANIFEST_SHA256: '0'.repeat(64) }),
  () => ({ ...inputs(), NAQL365_RELEASE_MANIFEST_SHA256: undefined }),
  () => ({ ...inputs(), NAQL365_RELEASE_MANIFEST_BASE64: undefined }),
  () => ({ ...inputs(), NAQL365_RELEASE_MANIFEST_BASE64: 'not base64' }),
  () => ({ ...inputs(), APP_ENV: 'staging' }),
  () => ({ ...inputs(), APP_URL: 'https://naql365-launch.vercel.app' }),
  () => ({ ...inputs(), NEXT_PUBLIC_SUPABASE_URL: 'https://zuvyfeflkzlciuaauxba.supabase.co' }),
  () => inputs({ sourceCommit: '0'.repeat(40) }),
  () => inputs({ identity: '' }),
])(
  'rejects invalid transport, stale releases or environment without overwriting the manifest (%#)',
  (make) => {
    expect(() => prepareReleaseManifest(make(), root)).toThrow();
    expect(readFileSync(target(), 'utf8')).toBe(original);
  },
);
it('preserves local, staging and pre-issued Vercel manifest workflows with no transport input', () => {
  for (const APP_ENV of ['local', 'staging', 'production'])
    prepareReleaseManifest({ APP_ENV }, root);
  expect(readFileSync(target(), 'utf8')).toBe(original);
});

it('verifies an exported checkout against the approved Git commit before installing the manifest', () => {
  const archive = mkdtempSync(join(tmpdir(), 'naql365-export-'));
  const gitCommitObject = execFileSync('git', ['cat-file', 'commit', source], {
    cwd: root,
  }).toString('base64');
  const input = inputs({ gitCommitObject });
  try {
    mkdirSync(join(archive, 'config'));
    writeFileSync(join(archive, 'next.config.ts'), 'export default {};');
    writeFileSync(join(archive, 'package-lock.json'), '{}');
    const path = join(archive, 'config/deployment-manifest.json');
    writeFileSync(path, original);
    expect(() => prepareReleaseManifest(inputs(), archive)).toThrow('ENV_SOURCE_PROOF_MISSING');
    expect(() =>
      prepareReleaseManifest(inputs({ gitCommitObject, sourceCommit: '0'.repeat(40) }), archive),
    ).toThrow('ENV_SOURCE_NOT_APPROVED');
    writeFileSync(join(archive, 'extra'), 'unexpected');
    expect(() => prepareReleaseManifest(input, archive)).toThrow('ENV_SOURCE_TREE_MISMATCH');
    rmSync(join(archive, 'extra'));
    writeFileSync(path, original + ' ');
    expect(() => prepareReleaseManifest(input, archive)).toThrow('ENV_SOURCE_TREE_MISMATCH');
    writeFileSync(path, original);
    prepareReleaseManifest(input, archive);
    expect(readFileSync(path, 'utf8')).toBe(
      Buffer.from(input.NAQL365_RELEASE_MANIFEST_BASE64, 'base64').toString(),
    );
  } finally {
    rmSync(archive, { recursive: true, force: true });
  }
});

it('reports approved paths only and rejects changed tracked source before installing the manifest', () => {
  const file = join(root, 'config');
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root });
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    writeFileSync(join(root, 'package-lock.json'), '{"synthetic":true}');
    writeFileSync(join(file, 'private filename'), 'private content');
    git('add', 'config/private filename');
    expect(() => prepareReleaseManifest(inputs(), root)).toThrow('ENV_SOURCE_TRACKED_CHANGED');
    expect(log).toHaveBeenCalledWith('ENV_SOURCE_CHANGED_PATHS=["package-lock.json"]');
    expect(readFileSync(target(), 'utf8')).toBe(original);
  } finally {
    writeFileSync(join(root, 'package-lock.json'), '{}');
    git('rm', '--cached', 'config/private filename');
    rmSync(join(file, 'private filename'));
    log.mockRestore();
  }
});

it.each(['exact', 'modified wrapper', 'modified backup'])(
  'checks the Hostinger config and then verifies the Git tree (%s)',
  (scenario) => {
    const config = join(root, 'next.config.ts');
    const backup = join(root, '6b0175fb40821.next.config.ts');
    const wrapper =
      'import type { NextConfig } from "next";\nimport baseConfig from "./6b0175fb40821.next.config";\n\nconst config: NextConfig = {\n  ...baseConfig,\n  output: "standalone",\n};\n\nexport default config;';
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      writeFileSync(config, scenario === 'modified wrapper' ? wrapper + '\n// extra' : wrapper);
      writeFileSync(backup, scenario === 'modified backup' ? 'changed' : 'export default {};');
      if (scenario === 'exact') {
        prepareReleaseManifest(inputs(), root);
        expect(readFileSync(config, 'utf8')).toBe('export default {};');
        expect(() => readFileSync(backup)).toThrow();
      } else {
        expect(() => prepareReleaseManifest(inputs(), root)).toThrow('ENV_SOURCE_TRACKED_CHANGED');
        expect(readFileSync(target(), 'utf8')).toBe(original);
      }
    } finally {
      writeFileSync(config, 'export default {};');
      rmSync(backup, { force: true });
      log.mockRestore();
    }
  },
);

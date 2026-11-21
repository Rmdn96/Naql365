import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { verifyProductionSource } from '../src/infrastructure/config/environment-authority.ts';

function objectId(type, bytes) {
  return createHash('sha1').update(`${type} ${bytes.length}\0`).update(bytes).digest();
}

// Reconstruct Git's tree from actual Linux checkout bytes, including paths and modes.
function checkoutTree(dir, root) {
  const entries = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (dir === root && entry.name === 'node_modules' && entry.isDirectory()) continue;
    const path = join(dir, entry.name);
    let mode, id;
    if (entry.isDirectory()) {
      id = checkoutTree(path, root);
      if (!id) continue; // Git does not track empty directories.
      mode = '40000';
    } else if (entry.isFile()) {
      mode = lstatSync(path).mode & 0o100 ? '100755' : '100644';
      id = objectId('blob', readFileSync(path));
    } else throw Error('ENV_SOURCE_ENTRY_UNSUPPORTED');
    entries.push({
      sortKey: Buffer.from(entry.name + (entry.isDirectory() ? '/' : '')),
      bytes: Buffer.concat([Buffer.from(`${mode} ${entry.name}\0`), id]),
    });
  }
  entries.sort((a, b) => a.sortKey.compare(b.sortKey));
  return entries.length
    ? objectId('tree', Buffer.concat(entries.map((entry) => entry.bytes)))
    : null;
}

// Hostinger moves the original config aside and generates a standalone wrapper.
function restoreHostingerConfig(root) {
  const path = join(root, 'next.config.ts');
  if (!lstatSync(path, { throwIfNoEntry: false })?.isFile()) return;
  const wrapper = readFileSync(path, 'utf8');
  const prefix = /import baseConfig from "\.\/([a-f0-9]{13})\.next\.config";/.exec(wrapper)?.[1];
  if (!prefix) return;
  const expected = [
    'import type { NextConfig } from "next";',
    `import baseConfig from "./${prefix}.next.config";`,
    '',
    'const config: NextConfig = {',
    '  ...baseConfig,',
    '  output: "standalone",',
    '};',
    '',
    'export default config;',
  ].join('\n');
  if (wrapper !== expected) return;
  const backup = join(root, `${prefix}.next.config.ts`);
  if (!lstatSync(backup, { throwIfNoEntry: false })?.isFile()) return;
  const approved = spawnSync('git', ['cat-file', 'blob', 'HEAD:next.config.ts'], { cwd: root });
  if (approved.status !== 0 || !readFileSync(backup).equals(approved.stdout)) return;
  renameSync(backup, path);
}

export function verifyBuildSource(manifest, root, transported = false) {
  const git = (args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  const head = git(['rev-parse', 'HEAD']);
  if (head.status === 0) {
    const prefix = git(['rev-parse', '--show-prefix']);
    if (prefix.status !== 0 || prefix.stdout.trim()) throw Error('ENV_SOURCE_ROOT_MISMATCH');
    verifyProductionSource(manifest, head.stdout.trim());
    if (
      transported &&
      manifest.production?.origin === 'https://purple-skunk-677919.hostingersite.com'
    )
      restoreHostingerConfig(root);
    const changed = git([
      'diff',
      '--name-status',
      '--no-renames',
      '-z',
      'HEAD',
      '--',
      '.',
      ':!config/deployment-manifest.json',
    ]);
    if (changed.status !== 0) throw Error('ENV_SOURCE_DIFF_UNAVAILABLE');
    if (changed.stdout) {
      const fields = changed.stdout.split('\0');
      const paths = [];
      for (let index = 0; index + 1 < fields.length; index += 2) {
        // A staged addition may introduce a private filename absent from the approved tree.
        if (fields[index] !== 'A') paths.push(fields[index + 1]);
      }
      console.error('ENV_SOURCE_CHANGED_PATHS=' + JSON.stringify(paths));
      throw Error('ENV_SOURCE_TRACKED_CHANGED');
    }
    const others = git(['ls-files', '--others', '--exclude-standard']);
    if (others.status !== 0) throw Error('ENV_SOURCE_STATUS_UNAVAILABLE');
    if (others.stdout.trim()) throw Error('ENV_SOURCE_UNTRACKED_FILES');
    return;
  }
  if (
    lstatSync(join(root, '.git'), { throwIfNoEntry: false }) ||
    !transported ||
    manifest.production?.origin !== 'https://purple-skunk-677919.hostingersite.com'
  )
    throw Error('ENV_SOURCE_HEAD_UNAVAILABLE');
  const proof = manifest.production.gitCommitObject;
  if (typeof proof !== 'string' || !proof.length) throw Error('ENV_SOURCE_PROOF_MISSING');
  const commit = Buffer.from(proof, 'base64');
  if (commit.toString('base64') !== proof) throw Error('ENV_SOURCE_PROOF_INVALID');
  verifyProductionSource(manifest, objectId('commit', commit).toString('hex'));
  const tree = /^tree ([0-9a-f]{40})\n/.exec(commit.toString('utf8'))?.[1];
  if (!tree || checkoutTree(root, root)?.toString('hex') !== tree)
    throw Error('ENV_SOURCE_TREE_MISMATCH');
}

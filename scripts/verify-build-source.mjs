import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
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

export function verifyBuildSource(manifest, root, transported = false) {
  const git = (args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  const head = git(['rev-parse', 'HEAD']);
  if (head.status === 0) {
    const prefix = git(['rev-parse', '--show-prefix']);
    if (prefix.status !== 0 || prefix.stdout.trim()) throw Error('ENV_SOURCE_ROOT_MISMATCH');
    verifyProductionSource(manifest, head.stdout.trim());
    const changed = git([
      'diff',
      '--name-only',
      'HEAD',
      '--',
      '.',
      ':!config/deployment-manifest.json',
    ]);
    if (changed.status !== 0) throw Error('ENV_SOURCE_DIFF_UNAVAILABLE');
    if (changed.stdout.trim()) throw Error('ENV_SOURCE_TRACKED_CHANGED');
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

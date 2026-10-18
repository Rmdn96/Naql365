import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const baseline = '29baff49a143e2ed24856c80cbc08c9b65c3f941';
const folder = 'supabase/migrations/';
const added = '20261018000100_store_catalog_foundation.sql';
const old = execFileSync('git', ['ls-tree', '--name-only', baseline, folder], { encoding: 'utf8' })
  .trim()
  .split('\n');
assert.equal(old.length, 47);
const hash = (data) => createHash('sha256').update(data).digest('hex');
const hashes = old.map((path) => {
  const committed = execFileSync('git', ['show', baseline + ':' + path]);
  const local = readFileSync(path);
  // Compare the exact bytes Git will commit, honoring repository clean filters.
  // Existing Windows checkout mixed-EOL anomalies are reported, never rewritten.
  const localBlob = execFileSync('git', ['hash-object', '--path=' + path, path], {
    encoding: 'utf8',
  }).trim();
  const baselineBlob = execFileSync('git', ['rev-parse', baseline + ':' + path], {
    encoding: 'utf8',
  }).trim();
  assert.equal(localBlob, baselineBlob, 'Accepted migration Git blob changed: ' + path);
  const canonical = execFileSync('git', ['cat-file', 'blob', localBlob]);
  assert.equal(hash(canonical), hash(committed), 'Canonical migration bytes changed: ' + path);
  return {
    path,
    sha256: hash(canonical),
    checkoutSha256: hash(local),
    checkoutByteIdentical: hash(local) === hash(committed),
  };
});
assert.deepEqual(
  readdirSync(folder)
    .filter((n) => n.endsWith('.sql'))
    .sort(),
  [...old.map((n) => n.slice(folder.length)), added].sort(),
);
const source = readFileSync(folder + added, 'utf8');
assert.equal((source.match(/create table private\.store_/g) || []).length, 10);
assert.equal((source.match(/create function public\.store_/g) || []).length, 7);
assert(
  !/create\s+(?:table|function)\s+(?:public|private)\.store_(?:orders|payments|carts|settlements|refunds)|insert into public\.role_permissions|storage\.buckets/i.test(
    source,
  ),
);
const result = {
  baseline,
  originalMigrationCount: old.length,
  originalMigrationsByteIdentical: true,
  migrationCount: 48,
  added: folder + added,
  sha256: hash(source),
  previous: hashes,
};
mkdirSync('test-results/store-6d-1a', { recursive: true });
writeFileSync(
  'test-results/store-6d-1a/migration-integrity.json',
  JSON.stringify(result, null, 2) + '\n',
);
console.log(
  'Migration integrity PASS: 47 byte-identical, one additive catalog migration, ten tables and seven public RPCs.',
);

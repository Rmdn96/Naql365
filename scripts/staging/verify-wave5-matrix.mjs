import { createHash } from 'node:crypto';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { requiredDriverMatrix } from '../../tests/helpers/driver-v2-matrix.ts';
const directory = 'docs/reports/evidence/lovable-wave5-driver-final';
const index = JSON.parse(readFileSync(join(directory, 'index.json'), 'utf8'));
const required = requiredDriverMatrix();
const expected = new Map(required.map((row) => [row.id, row]));
if (index.applicationSha !== process.env.ACCEPTANCE_APPLICATION_SHA)
  throw Error('APPLICATION_IDENTITY_MISMATCH');
const seen = new Set();
for (const row of index.rows) {
  const definition = expected.get(row.id);
  if (
    !definition ||
    seen.has(row.id) ||
    row.result !== 'PASS' ||
    row.applicationSha !== index.applicationSha ||
    Object.entries(definition).some(([k, v]) => row[k] !== v) ||
    row.filename !== row.id + '.png' ||
    !existsSync(join(directory, row.filename)) ||
    createHash('sha256')
      .update(readFileSync(join(directory, row.filename)))
      .digest('hex') !== row.sha256
  )
    throw Error('MATRIX_EVIDENCE_INVALID');
  seen.add(row.id);
}
const result = {
  applicationSha: index.applicationSha,
  total: required.length,
  pass: seen.size,
  missing: required.filter((row) => !seen.has(row.id)).map((row) => row.id),
  na: 0,
  result: seen.size === required.length ? 'PASS' : 'PARTIAL',
  verifiedAt: new Date().toISOString(),
};
writeFileSync(join(directory, 'completeness.json'), JSON.stringify(result, null, 2) + '\n');
console.log(
  JSON.stringify({
    result: result.result,
    total: result.total,
    pass: result.pass,
    missing: result.missing.length,
  }),
);
if (result.missing.length) process.exitCode = 1;

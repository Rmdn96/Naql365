import { readFileSync, readdirSync, writeFileSync, renameSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { applicationSha, locales, widths, states } from '../tests/stage2-states/matrix.ts';

const directory = process.argv[2];
if (!directory) throw Error('Explicit matrix evidence directory required');
const records = readdirSync(directory)
  .filter((file) => /^(ar|en)-\d+-.*\.json$/.test(file))
  .map((file) => JSON.parse(readFileSync(join(directory, file), 'utf8')));
const matrix = [];
for (const state of states)
  for (const locale of locales)
    for (const width of widths) {
      const matches = records.filter(
        (r) => r.state === state && r.locale === locale && r.viewport?.width === width,
      );
      let row = matches[0];
      if (matches.length !== 1)
        row = {
          state,
          locale,
          viewport: { width },
          result: 'FAIL',
          reason: matches.length ? 'Duplicate evidence' : 'Missing evidence',
        };
      else if (row.applicationSha !== applicationSha)
        row = { ...row, result: 'FAIL', reason: 'Wrong application identity' };
      else if (row.result === 'PASS') {
        const safeName =
          typeof row.filename === 'string' && basename(row.filename) === row.filename;
        const hash = safeName
          ? createHash('sha256')
              .update(readFileSync(join(directory, row.filename)))
              .digest('hex')
          : null;
        if (hash !== row.sha256 || !row.capturedAt)
          row = { ...row, result: 'FAIL', reason: 'Invalid capture evidence' };
      } else if (row.result === 'N/A' && (!row.reason || !row.sourceEvidence)) {
        row = {
          ...row,
          result: 'FAIL',
          reason: 'N/A requires product-state explanation and source evidence',
        };
      }
      matrix.push(row);
    }
const selected =
  process.argv[3] === 'A'
    ? matrix.filter((r) => r.state.startsWith('request-') || r.state.startsWith('account-'))
    : process.argv[3] === 'B'
      ? matrix.filter((r) => r.state.startsWith('quote-') || r.state.startsWith('checkout-'))
      : process.argv[3] === 'C'
        ? matrix.filter((r) => r.state.startsWith('tracking-') || r.state === 'signup-email-sent')
        : matrix;
const count = (result) => matrix.filter((row) => row.result === result).length;
const summary = {
  applicationSha,
  required: states.length * locales.length * widths.length,
  pass: count('PASS'),
  na: count('N/A'),
  fail: count('FAIL'),
  complete: matrix.every((row) => row.result === 'PASS' || row.result === 'N/A'),
};
writeFileSync(
  join(directory, 'index.json.tmp'),
  JSON.stringify({ summary, matrix }, null, 2) + '\n',
);
renameSync(join(directory, 'index.json.tmp'), join(directory, 'index.json'));
console.log(
  JSON.stringify({
    ...summary,
    family: process.argv[3] ?? 'all',
    familyRequired: selected.length,
    familyMissing: selected.filter((r) => r.result !== 'PASS' && r.result !== 'N/A').length,
  }),
);
if (!selected.every((r) => r.result === 'PASS' || r.result === 'N/A')) process.exitCode = 1;

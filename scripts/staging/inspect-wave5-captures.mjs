// Read-only pixel audit for the independently reproduced full-element capture artifact.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import sharp from 'sharp';
const directory = 'docs/reports/evidence/lovable-wave5-driver-final';
const index = JSON.parse(readFileSync(join(directory, 'index.json'), 'utf8'));
const flagged = [];
for (const row of index.rows) {
  if (basename(row.filename) !== row.filename) throw Error('EVIDENCE_PATH_DENIED');
  const { data, info } = await sharp(join(directory, row.filename))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let consecutive = 0;
  for (let y = 0; y < info.height; y++) {
    let run = 0,
      line = false;
    for (let x = 0; x < info.width; x++) {
      const k = (y * info.width + x) * info.channels;
      if (data[k] === 11 && data[k + 1] === 31 && data[k + 2] === 51) {
        if (++run >= 60) line = true;
      } else run = 0;
    }
    consecutive = line ? consecutive + 1 : 0;
    if (consecutive >= 10) {
      flagged.push(row.id);
      break;
    }
  }
}
const result = {
  applicationSha: index.applicationSha,
  checked: index.rows.length,
  flagged,
  result: flagged.length ? 'REVIEW_REQUIRED' : 'PASS',
  algorithm:
    'Off-viewport utility navy rectangle, at least 60px wide for 10 rows; diagnostic, not WCAG certification',
};
writeFileSync(
  join(directory, 'capture-artifact-audit.json'),
  JSON.stringify(result, null, 2) + '\n',
);
console.log(
  JSON.stringify({ checked: result.checked, flagged: flagged.length, result: result.result }),
);
if (flagged.length) process.exitCode = 1;

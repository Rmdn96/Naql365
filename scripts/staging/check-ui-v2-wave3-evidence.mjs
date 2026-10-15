import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

export function requiredWave3Evidence() {
  const states = [];
  for (const [country, locale] of [
    ['sa', 'ar'],
    ['eg', 'en'],
  ]) {
    for (const family of [
      'guest-start',
      'request-validation',
      'wizard-review',
      'request-under-review',
      'quote',
    ])
      states.push({ state: `${family}-${country}-${locale}`, locale });
    states.push(
      { state: `guest-${country}-payment`, locale },
      { state: `guest-${country}-tracking`, locale },
      { state: `guest-revoked-${country}-${locale}`, locale },
    );
    for (const [family, lang] of [
      ['customer', 'ar'],
      ['customer-pending-quote', 'ar'],
      ['request', 'en'],
      ['customer', 'en'],
      ['customer-cash', 'ar'],
      ['customer-accepted-quote', 'en'],
      ['customer-request-details', 'ar'],
      ['request-history', 'en'],
      ['quote-history', 'ar'],
    ])
      states.push({
        state: `${family}-${country}-${lang}${family === 'request' ? '-mobile' : ''}`,
        locale: lang,
      });
  }
  states.push(
    { state: 'quote-rejected-sa-ar', locale: 'ar' },
    { state: 'payment-cash-sa-ar', locale: 'ar' },
  );
  for (const state of [
    'payment-proof-pending-eg-en',
    'payment-proof-retry-eg-en',
    'payment-confirmed-eg-en',
  ])
    states.push({ state, locale: 'en' });
  const samples = states.flatMap(({ state, locale }) =>
    ['light', 'dark', 'system'].flatMap((theme) =>
      (theme === 'light' ? [360, 390, 768, 1280, 1440] : [360, 1440]).map((width) => ({
        state,
        locale,
        theme,
        width,
      })),
    ),
  );
  for (const country of ['sa', 'eg'])
    for (const locale of ['ar', 'en'])
      for (const width of [360, 390, 768, 1280, 1440])
        samples.push({ state: `account-loading-${country}`, locale, theme: 'system', width });
  return samples;
}
export function verifyWave3Evidence(directory, applicationSha) {
  const index = JSON.parse(readFileSync(join(directory, 'index.json'), 'utf8'));
  if (index.applicationSha !== applicationSha) throw Error('WAVE3_INDEX_IDENTITY_MISMATCH');
  const key = (r) => [r.state, r.locale, r.theme, r.width].join(':');
  const required = requiredWave3Evidence();
  const seen = new Set();
  for (const row of index.matrix) {
    if (
      seen.has(key(row)) ||
      row.applicationSha !== applicationSha ||
      row.result !== 'PASS' ||
      row.overflow !== false ||
      row.axeViolations !== 0 ||
      !/^[a-z0-9-]+\.png$/.test(row.filename)
    )
      throw Error('WAVE3_ROW_INVALID');
    if (
      createHash('sha256')
        .update(readFileSync(join(directory, row.filename)))
        .digest('hex') !== row.sha256
    )
      throw Error('WAVE3_HASH_INVALID');
    seen.add(key(row));
  }
  const missing = required.filter((row) => !seen.has(key(row)));
  return {
    required: required.length,
    passed: index.matrix.length,
    missing: missing.length,
    missingStates: missing.map(key),
    result: missing.length === 0 ? 'PASS' : 'INCOMPLETE',
  };
}
if (process.argv[1]?.replaceAll('\\', '/').endsWith('/check-ui-v2-wave3-evidence.mjs')) {
  const result = verifyWave3Evidence(process.argv[2], process.argv[3]);
  console.log(JSON.stringify(result));
  if (result.result !== 'PASS') process.exitCode = 1;
}

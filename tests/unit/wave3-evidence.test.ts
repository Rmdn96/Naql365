import { expect, test } from 'vitest';
import { requiredWave3Evidence } from '../../scripts/staging/check-ui-v2-wave3-evidence.mjs';

test('Wave 3 risk matrix requires each implemented journey family and all responsive widths', () => {
  const rows = requiredWave3Evidence();
  expect(rows).toHaveLength(371);
  expect(new Set(rows.map((r) => [r.state, r.locale, r.theme, r.width].join(':'))).size).toBe(371);
  expect([...new Set(rows.map((r) => r.width))].sort((a, b) => a - b)).toEqual([
    360, 390, 768, 1280, 1440,
  ]);
  for (const locale of ['ar', 'en'])
    for (const theme of ['light', 'dark', 'system'])
      expect(rows.some((r) => r.locale === locale && r.theme === theme)).toBe(true);
  for (const country of ['sa', 'eg'])
    expect(rows.some((r) => r.state === `customer-accepted-quote-${country}-en`)).toBe(true);
  for (const country of ['sa', 'eg'])
    expect(rows.some((r) => r.state === `customer-pending-quote-${country}-ar`)).toBe(true);
  expect(rows.some((r) => r.state === 'payment-proof-retry-eg-en')).toBe(true);
  expect(rows.some((r) => r.state === 'quote-rejected-sa-ar')).toBe(true);
});

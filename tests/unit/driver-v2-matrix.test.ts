import { expect, it } from 'vitest';
import { requiredDriverMatrix, driverVisualStates } from '../helpers/driver-v2-matrix';
it('defines unique evidence IDs for each Driver state in both Markets and languages', () => {
  const rows = requiredDriverMatrix();
  expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
  for (const state of driverVisualStates)
    for (const market of ['SA', 'EG'])
      for (const locale of ['ar', 'en'])
        expect(
          rows.some((r) => r.state === state && r.market === market && r.locale === locale),
        ).toBe(true);
});
it('covers all required widths and both System preferences without inventing business data', () => {
  const rows = requiredDriverMatrix();
  expect(new Set(rows.map((r) => r.width))).toEqual(new Set([360, 390, 768, 1280, 1440]));
  expect(new Set(rows.map((r) => r.theme))).toEqual(new Set(['light', 'dark', 'system']));
  expect(new Set(rows.filter((r) => r.theme === 'system').map((r) => r.system))).toEqual(
    new Set(['light', 'dark']),
  );
});

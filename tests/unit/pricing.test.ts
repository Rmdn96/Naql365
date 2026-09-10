import { describe, expect, it } from 'vitest';
import {
  calculatePriceInput,
  createQuoteInput,
  formatSar,
  parseSarToMinor,
} from '@/domain/pricing/model';

describe('Phase 2 pricing values', () => {
  it('parses SAR without binary floating-point authority', () => {
    expect(parseSarToMinor('230.00')).toBe(23000);
    expect(parseSarToMinor('-1.75')).toBe(-175);
    expect(parseSarToMinor('1.001')).toBeNull();
    expect(parseSarToMinor('NaN')).toBeNull();
    expect(formatSar(23000, 'en')).toContain('230.00');
  });

  it('bounds verified road distance and operational inputs', () => {
    const base = {
      requestId: '51000000-0000-4000-8000-000000000001',
      vehicleClassId: '61000000-0000-4000-8000-000000000001',
      workerCount: 2,
      mutationId: '69000000-0000-4000-8000-000000000001',
    };
    expect(calculatePriceInput.safeParse({ ...base, distanceKm: 12.345 }).success).toBe(true);
    expect(calculatePriceInput.safeParse({ ...base, distanceKm: 0 }).success).toBe(false);
    expect(calculatePriceInput.safeParse({ ...base, distanceKm: 12.3456 }).success).toBe(false);
    expect(calculatePriceInput.safeParse({ ...base, distanceKm: 5001 }).success).toBe(false);
  });

  it('requires a reason for every manual adjustment', () => {
    const base = {
      evaluationId: '69000000-0000-4000-8000-000000000001',
      mutationId: '71000000-0000-4000-8000-000000000001',
      validitySeconds: 172800,
    };
    expect(createQuoteInput.safeParse({ ...base, adjustmentMinor: 0 }).success).toBe(true);
    expect(createQuoteInput.safeParse({ ...base, adjustmentMinor: 100 }).success).toBe(false);
    expect(
      createQuoteInput.safeParse({
        ...base,
        adjustmentMinor: -100,
        adjustmentReason: 'Approved discount',
      }).success,
    ).toBe(true);
  });
});

import { expect, it } from 'vitest';
import {
  formatMoney,
  localScheduleToInstant,
  marketDate,
  marketDateTime,
  normalizeMarketPhone,
} from '@/domain/markets/model';

it('uses actual IANA winter/summer offsets independently of locale', () => {
  expect(localScheduleToInstant('2026-01-15T10:00', 'Asia/Riyadh')).toBe(
    '2026-01-15T07:00:00.000Z',
  );
  expect(localScheduleToInstant('2026-01-15T10:00', 'Africa/Cairo')).toBe(
    '2026-01-15T08:00:00.000Z',
  );
  expect(localScheduleToInstant('2026-07-15T10:00', 'Africa/Cairo')).toBe(
    '2026-07-15T07:00:00.000Z',
  );
  expect(marketDateTime(new Date('2026-01-15T08:00Z'), 'Africa/Cairo')).toBe('2026-01-15T10:00');
});
it('rejects nonexistent and ambiguous Cairo wall times and invalid dates', () => {
  expect(() => localScheduleToInstant('2026-04-24T00:30', 'Africa/Cairo')).toThrow();
  expect(() => localScheduleToInstant('2026-10-29T23:30', 'Africa/Cairo')).toThrow();
  expect(() => localScheduleToInstant('2026-02-31T12:00', 'Africa/Cairo')).toThrow();
});
it('preserves separate local month boundaries', () => {
  const instant = new Date('2026-01-31T21:30Z');
  expect(marketDate(instant, 'Asia/Riyadh')).toBe('2026-02-01');
  expect(marketDate(instant, 'Africa/Cairo')).toBe('2026-01-31');
});
it('formats explicit currencies without FX or locale inference', () => {
  for (const locale of ['ar', 'en'] as const) {
    expect(formatMoney(12345, 'SAR', locale)).toContain('SAR');
    expect(formatMoney(12345, 'EGP', locale)).toContain('EGP');
  }
  expect(formatMoney(12345, 'EGP', 'en')).toContain('123.45');
  expect(() => formatMoney(1.5, 'EGP', 'en')).toThrow();
});
it('normalizes national input with explicit country context and preserves international contacts', () => {
  expect(normalizeMarketPhone('0500000001', '+966')).toBe('+966500000001');
  expect(normalizeMarketPhone('01000000001', '+20')).toBe('+201000000001');
  expect(normalizeMarketPhone('٠١٠٠٠٠٠٠٠٠١', '+20')).toBe('+201000000001');
  expect(normalizeMarketPhone('00201000000001')).toBe('+201000000001');
  expect(normalizeMarketPhone('+966500000001', '+20')).toBe('+966500000001');
  expect(normalizeMarketPhone('01000000001')).toBe('01000000001');
});

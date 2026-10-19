import { expect, it } from 'vitest';
import { storeTotals } from '@/domain/store/totals';
const contract = {
  deliveryMinor: 200,
  taxBps: 0,
  taxMode: 'ADDITIVE' as const,
  taxDelivery: false,
};
it('estimates approved integer prices and delivery without commission or FX', () =>
  expect(storeTotals([{ quantity: 2, amountMinor: 1000 }], contract)).toEqual({
    subtotal: 2000,
    delivery: 200,
    tax: 0,
    total: 2200,
  }));
it('only taxes delivery when explicitly configured', () => {
  expect(
    storeTotals([{ quantity: 1, amountMinor: 1000 }], { ...contract, taxBps: 1000 })?.total,
  ).toBe(1300);
  expect(
    storeTotals([{ quantity: 1, amountMinor: 1000 }], {
      ...contract,
      taxBps: 1000,
      taxDelivery: true,
    })?.total,
  ).toBe(1320);
});
it('separates included tax without adding it twice', () =>
  expect(
    storeTotals([{ quantity: 1, amountMinor: 1100 }], {
      ...contract,
      taxBps: 1000,
      taxMode: 'INCLUDED',
    })?.tax,
  ).toBe(100));
it('rounds positive minor-unit halves consistently with PostgreSQL round', () =>
  expect(storeTotals([{ quantity: 1, amountMinor: 5 }], { ...contract, taxBps: 1000 })?.tax).toBe(
    1,
  ));
it('rejects unsafe aggregate money, invalid quantities and invented zero prices', () => {
  expect(
    storeTotals([{ quantity: 999, amountMinor: Number.MAX_SAFE_INTEGER }], contract),
  ).toBeNull();
  expect(storeTotals([{ quantity: 0, amountMinor: 1000 }], contract)).toBeNull();
  expect(storeTotals([{ quantity: 1, amountMinor: 0 }], contract)).toBeNull();
});

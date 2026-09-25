import { expect, it } from 'vitest';
import { paymentCommand, bankConfiguration } from '@/domain/payments/model';
const id = '13000000-0000-4000-8000-000000000001';
it('rejects forged scope, totals and status fields in checkout', () => {
  const command = {
    orderId: id,
    mutationId: id,
    revision: 0,
    action: 'choose',
    payload: { method: 'CASH' },
  };
  expect(paymentCommand.safeParse(command).success).toBe(true);
  for (const added of [{ organizationId: id }, { status: 'PAID' }, { driverId: id }])
    expect(paymentCommand.safeParse({ ...command, ...added }).success).toBe(false);
  for (const payload of [
    { method: 'CARD' },
    { method: 'CASH', amountMinor: 1 },
    { method: 'BANK_TRANSFER', bankId: id },
  ])
    expect(paymentCommand.safeParse({ ...command, payload }).success).toBe(false);
});
it('requires exact integer money, supported currency and a bounded rejection reason', () => {
  const command = {
    orderId: id,
    mutationId: id,
    revision: 1,
    action: 'confirm_cash',
    payload: { amountMinor: 11500, currency: 'SAR' },
  };
  expect(paymentCommand.safeParse(command).success).toBe(true);
  for (const amountMinor of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, Infinity])
    expect(
      paymentCommand.safeParse({ ...command, payload: { ...command.payload, amountMinor } })
        .success,
    ).toBe(false);
  expect(
    paymentCommand.safeParse({ ...command, payload: { ...command.payload, currency: 'USD' } })
      .success,
  ).toBe(false);
  for (const reason of ['', '  ', 'x'.repeat(501)])
    expect(
      paymentCommand.safeParse({
        ...command,
        action: 'reject_transfer',
        payload: { attemptId: id, reason },
      }).success,
    ).toBe(false);
});
it('bank configuration derives currency and requires a usable account identifier', () => {
  const command = {
    organizationId: id,
    marketId: id,
    id,
    revision: 0,
    mutationId: id,
    details: {
      bankNameAr: 'اختبار',
      bankNameEn: 'Test',
      beneficiaryAr: 'اختبار',
      beneficiaryEn: 'Test',
      iban: '',
      accountNumber: 'TEST-ONLY',
      bic: '',
      instructionsAr: '',
      instructionsEn: '',
      active: true,
      primary: true,
    },
  };
  expect(bankConfiguration.safeParse(command).success).toBe(true);
  expect(
    bankConfiguration.safeParse({ ...command, details: { ...command.details, currency: 'SAR' } })
      .success,
  ).toBe(false);
  expect(
    bankConfiguration.safeParse({ ...command, details: { ...command.details, accountNumber: '' } })
      .success,
  ).toBe(false);
});

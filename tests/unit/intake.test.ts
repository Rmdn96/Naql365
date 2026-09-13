import { marketDate } from '@/domain/markets/model';
import { expect, it } from 'vitest';
import {
  blankDraft,
  draftInput,
  phoneInput,
  profileInput,
  commandInput,
  imageMime,
  submissionIssues,
} from '@/domain/requests/intake';
it.each([
  ['+966501234567', '+966501234567'],
  ['+٢٠١٠١٢٣٤٥٦٧٨', '+201012345678'],
  ['00442079460958', '+442079460958'],
  ['+1 (202) 555-0123', '+12025550123'],
])('normalizes phone %s to an explicit international canonical value', (raw, canonical) =>
  expect(phoneInput.parse(raw)).toBe(canonical),
);
it.each(['123', 'admin@example.test', '+0000000000', '+12345678901234567'])(
  'rejects malformed phone %s',
  (value) => expect(phoneInput.safeParse(value).success).toBe(false),
);
it('rejects customer-supplied role and ownership fields', () => {
  expect(
    profileInput.safeParse({
      name: 'Fixture',
      phone: '+966500000001',
      locale: 'ar',
      role: 'SUPER_ADMIN',
    }).success,
  ).toBe(false);
  expect(
    draftInput.safeParse({ ...blankDraft(), organization_id: crypto.randomUUID() }).success,
  ).toBe(false);
  expect(
    commandInput.safeParse({
      operation: 'submit',
      revision: 0,
      mutationId: crypto.randomUUID(),
      reference: 'FORGED',
    }).success,
  ).toBe(false);
});
it.each([0, -1, 1.5, 10001])('rejects invalid item quantity %s', (quantity) =>
  expect(
    draftInput.safeParse({ ...blankDraft(), items: [{ description: 'Box', quantity, notes: '' }] })
      .success,
  ).toBe(false),
);
it('uses Riyadh date at UTC midnight boundary', () =>
  expect(marketDate(new Date('2026-09-09T21:30:00Z'), 'Asia/Riyadh')).toBe('2026-09-10'));
it('requires the persisted business payload to be complete before submission UX', () =>
  expect(submissionIssues(blankDraft(), 'Asia/Riyadh')).toEqual([
    'service',
    'route',
    'shipment',
    'schedule',
    'contact',
  ]));
it('limits strings, catalogue selections and duplicate options', () => {
  const id = crypto.randomUUID();
  expect(draftInput.safeParse({ ...blankDraft(), description: 'x'.repeat(2001) }).success).toBe(
    false,
  );
  expect(draftInput.safeParse({ ...blankDraft(), additional_service_ids: [id, id] }).success).toBe(
    false,
  );
  expect(draftInput.safeParse({ ...blankDraft(), service_id: 'not-a-catalogue-id' }).success).toBe(
    false,
  );
});
it('detects image signatures and rejects executable or renamed document bytes', () => {
  expect(imageMime(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))).toBe('image/png');
  expect(imageMime(new TextEncoder().encode('<script>alert(1)</script>'))).toBeNull();
  expect(imageMime(new TextEncoder().encode('%PDF-1.4'))).toBeNull();
});

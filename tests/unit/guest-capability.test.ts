import { expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import {
  guestContinuationPath,
  guestExchange,
  secretFromFragment,
} from '@/domain/guest/capability';
import { createGuestSecret, guestVerifier } from '@/infrastructure/guest/secret';

test('guest continuation carries a canonical random secret only in the fragment', () => {
  const token = createGuestSecret();
  expect(token).toMatch(/^g1_[0-9a-f]{64}$/);
  expect(createGuestSecret()).not.toBe(token);
  const url = new URL(guestContinuationPath('ar', token), 'https://example.invalid');
  expect(url.pathname).toBe('/ar/guest');
  expect(url.search).toBe('');
  expect(secretFromFragment(url.hash)).toBe(token);
  expect(guestVerifier(token)).toBe(createHash('sha256').update(token).digest('hex'));
  expect(guestVerifier(token)).not.toContain(token);
});

test('reference, UUID, query fallback, noncanonical and ambiguous credentials fail closed', () => {
  for (const input of [
    '',
    'N365-202609-00125',
    '00000000-0000-4000-8000-000000000001',
    `g1_${'a'.repeat(63)}`,
    `g1_${'A'.repeat(64)}`,
    `g1_${'a'.repeat(64)}&next=/portal`,
  ]) {
    expect(secretFromFragment(`#${input}`)).toBeNull();
    expect(() => guestVerifier(input)).toThrow();
  }
  const token = createGuestSecret();
  expect(secretFromFragment(`?token=${token}`)).toBeNull();
  expect(guestExchange.safeParse({ token, organization_id: 'forged' }).success).toBe(false);
});

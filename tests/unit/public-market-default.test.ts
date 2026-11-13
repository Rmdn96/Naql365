import { beforeEach, expect, it, vi } from 'vitest';
import { selectedPublicCountry } from '@/infrastructure/markets/public';

const preference = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: preference.get }) }));
vi.mock('@/infrastructure/guest/session', () => ({ guestDatabase: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

it('defaults a fresh visitor to Egypt without writing a preference or granting authority', async () => {
  preference.get.mockReturnValue(undefined);
  expect(await selectedPublicCountry()).toBe('EG');
  expect(preference.get).toHaveBeenCalledExactlyOnceWith('naql365_market');
});

it.each(['EG', 'SA'])('resolves an explicit %s preference to Egypt', async (value) => {
  preference.get.mockReturnValue({ value });
  expect(await selectedPublicCountry()).toBe('EG');
});

it.each(['', 'ZZ', 'eg', '../SA'])('uses Egypt for invalid preference %j', async (value) => {
  preference.get.mockReturnValue({ value });
  expect(await selectedPublicCountry()).toBe('EG');
});

it('normalizes an old Saudi cookie across successive server reads', async () => {
  preference.get.mockReturnValue({ value: 'SA' });
  expect(await selectedPublicCountry()).toBe('EG');
  preference.get.mockReturnValue({ value: 'EG' });
  expect(await selectedPublicCountry()).toBe('EG');
  expect(await selectedPublicCountry()).toBe('EG');
});

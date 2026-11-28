import { afterEach, expect, it, vi } from 'vitest';
import { transportIntakeEnabled } from '@/infrastructure/config/deployment-env';

afterEach(() => vi.unstubAllEnvs());
it('requires explicit opt-in to collect a new transport enquiry in production', () => {
  vi.stubEnv('APP_ENV', 'production');
  for (const value of ['', 'false', '1', 'TRUE']) {
    vi.stubEnv('NAQL365_TRANSPORT_INTAKE_ENABLED', value);
    expect(transportIntakeEnabled()).toBe(false);
  }
  vi.stubEnv('NAQL365_TRANSPORT_INTAKE_ENABLED', 'true');
  expect(transportIntakeEnabled()).toBe(true);
});
it('keeps isolated transport workflows available', () => {
  vi.stubEnv('APP_ENV', 'local');
  expect(transportIntakeEnabled()).toBe(true);
});

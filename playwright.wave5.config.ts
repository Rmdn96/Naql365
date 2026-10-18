import { defineConfig, devices } from '@playwright/test';
import { acceptanceTarget } from './scripts/staging/target.mjs';
const { origin } = acceptanceTarget();
if (origin !== 'https://naql365-staging-ui-v2-naql365.vercel.app')
  throw Error('WAVE5_CANONICAL_REQUIRED');
export default defineConfig({
  testDir: './tests/wave5',
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  // Includes indexed visual capture work; command/expect timeouts are unchanged.
  timeout: 1200000,
  expect: { timeout: 20000 },
  reporter: './tests/staging/safe-reporter.ts',
  use: {
    baseURL: origin,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    navigationTimeout: 45000,
    actionTimeout: 20000,
  },
  projects: [{ name: 'hosted-wave5', use: { ...devices['Desktop Chrome'] } }],
});

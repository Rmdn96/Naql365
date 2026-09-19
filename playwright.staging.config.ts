import { defineConfig, devices } from '@playwright/test';

const origin = new URL(process.env.STAGING_BASE_URL || 'http://invalid');
if (
  origin.protocol !== 'https:' ||
  origin.username ||
  origin.password ||
  origin.pathname !== '/' ||
  origin.search ||
  origin.hash
) {
  throw new Error('STAGING_BASE_URL must be the verified HTTPS staging origin');
}

export default defineConfig({
  testDir: './tests/staging',
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  // These hosted journeys include several remote navigations and Auth round trips.
  // Keep each action bounded while allowing the complete journey to finish.
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: './tests/staging/safe-reporter.ts',
  use: {
    baseURL: origin.origin,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    navigationTimeout: 45_000,
    actionTimeout: 20_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
});

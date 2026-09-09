import { defineConfig, devices } from '@playwright/test';
const origin = new URL(process.env.STAGING_BASE_URL || 'http://invalid');
if (
  origin.protocol !== 'https:' ||
  origin.username ||
  origin.password ||
  origin.pathname !== '/' ||
  origin.search ||
  origin.hash
)
  throw new Error('Verified HTTPS Preview required');
export default defineConfig({
  testDir: './tests/intake',
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  timeout: 180000,
  reporter: './tests/staging/safe-reporter.ts',
  use: { baseURL: origin.origin, trace: 'off', screenshot: 'off', video: 'off' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
});

import { defineConfig, devices } from '@playwright/test';
const origin = process.env.STAGING_BASE_URL;
if (!origin) throw new Error('STAGING_BASE_URL is required');
export default defineConfig({
  testDir: './tests/phase2',
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  timeout: 240000,
  reporter: './tests/staging/safe-reporter.ts',
  use: { baseURL: new URL(origin).origin, trace: 'off', screenshot: 'off', video: 'off' },
  projects: [{ name: 'hosted-phase2', use: { ...devices['Desktop Chrome'] } }],
});

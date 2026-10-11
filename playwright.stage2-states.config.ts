import { acceptanceTarget } from './scripts/staging/target.mjs';
import { defineConfig } from '@playwright/test';
acceptanceTarget();
export default defineConfig({
  testDir: './tests/stage2-states',
  workers: 1,
  retries: 0,
  timeout: 300000,
  reporter: './tests/staging/safe-reporter.ts',
  use: {
    baseURL: process.env.STAGING_BASE_URL,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    navigationTimeout: 45000,
  },
});

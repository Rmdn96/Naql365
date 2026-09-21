import { defineConfig, devices } from '@playwright/test';
const origin = process.env.STAGING_BASE_URL;
if (!origin || !/^https:\/\/naql365-staging-[a-z0-9-]+\.vercel\.app$/.test(origin))
  throw new Error('Verified Phase 5 Preview origin required');
export default defineConfig({
  testDir: './tests/phase5',
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
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
  projects: [{ name: 'hosted-phase5', use: { ...devices['Desktop Chrome'] } }],
});

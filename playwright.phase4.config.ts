import { defineConfig, devices } from '@playwright/test';
const origin = process.env.STAGING_BASE_URL;
if (!origin || !/^https:\/\/naql365-staging-[a-z0-9-]+\.vercel\.app$/.test(origin))
  throw new Error('Verified Phase 4 Preview origin required');
export default defineConfig({
  testDir: './tests/phase4',
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  timeout: 900000,
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
  projects: [{ name: 'hosted-phase4', use: { ...devices['Desktop Chrome'] } }],
});

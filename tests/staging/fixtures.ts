import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  context: async ({ context, baseURL }, provide) => {
    const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    if (secret) {
      // Restrict this credential to the verified application origin, including redirects.
      await context.route('**/*', async (route) => {
        if (new URL(route.request().url()).origin === baseURL) {
          await route.continue({
            headers: { ...route.request().headers(), 'x-vercel-protection-bypass': secret },
          });
        } else await route.continue();
      });
    }
    await provide(context);
  },
});
export { expect };

export function testIdentity() {
  const email = process.env.STAGING_TEST_USER_EMAIL;
  const password = process.env.STAGING_TEST_USER_PASSWORD;
  if (!email || !password) throw new Error('Controlled staging test identity required');
  return { email, password };
}

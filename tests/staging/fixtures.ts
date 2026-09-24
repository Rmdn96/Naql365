import { test as base, expect } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';

const scriptGates = new WeakMap<Page, Promise<void>>();
export function holdApplicationScripts(page: Page) {
  if (scriptGates.has(page)) throw new Error('Script gate already active');
  let release!: () => void;
  scriptGates.set(
    page,
    new Promise<void>((resolve) => {
      release = resolve;
    }),
  );
  return () => {
    scriptGates.delete(page);
    release();
  };
}

export async function configureProtectedContext(context: BrowserContext, baseURL?: string) {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (secret) {
    // Restrict this credential to the verified application origin, including redirects.
    await context.route('**/*', async (route) => {
      if (new URL(route.request().url()).origin === baseURL) {
        if (
          route.request().resourceType() === 'script' &&
          new URL(route.request().url()).pathname.startsWith('/_next/static/')
        ) {
          const page = route.request().frame().page();
          await scriptGates.get(page);
        }
        await route.continue({
          headers: { ...route.request().headers(), 'x-vercel-protection-bypass': secret },
        });
      } else await route.continue();
    });
  }
}

export const test = base.extend({
  context: async ({ context, baseURL }, provide) => {
    await configureProtectedContext(context, baseURL);
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

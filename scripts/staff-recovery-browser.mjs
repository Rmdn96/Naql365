import { expect } from '@playwright/test';

// Only the synthetic user provisioned by the local commerce harness can be used here.
export async function checkStaffRecovery(browser, email, apiUrl, origin) {
  if (origin !== 'http://127.0.0.1:3000' || !/^store-\d+-\d+@example\.invalid$/.test(email))
    throw Error('Local synthetic recovery identity required');
  const backend = new URL(apiUrl);
  if (!['localhost', '127.0.0.1'].includes(backend.hostname) || backend.port !== '54321')
    throw Error('Local Supabase required');
  const ctx = await browser.newContext();
  try {
    const page = await ctx.newPage();
    await page.goto(origin + '/en/recover');
    await page.locator('[name=email]').fill(email);
    await page.locator('.auth-form button[type=submit]').click();
    const inbox = 'http://127.0.0.1:54324';
    let messageId;
    await expect
      .poll(
        async () => {
          const messages = await (await fetch(inbox + '/api/v1/messages')).json();
          messageId = messages.messages.find((m) => m.To.some((t) => t.Address === email))?.ID;
          return Boolean(messageId);
        },
        { timeout: 15000 },
      )
      .toBe(true);
    const mail = await (
      await fetch(inbox + '/api/v1/message/' + encodeURIComponent(messageId))
    ).json();
    const verifier = await page.evaluate((html) => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return Array.from(doc.querySelectorAll('a[href]'))
        .map((a) => a.getAttribute('href'))
        .find((h) => h.includes('/auth/v1/verify'));
    }, mail.HTML);
    const url = new URL(verifier);
    if (
      url.origin !== backend.origin ||
      url.pathname !== '/auth/v1/verify' ||
      url.searchParams.get('type') !== 'recovery'
    )
      throw Error('Unexpected local verifier');
    // Do not put the token-bearing URL into a trace, test screenshot or error report.
    await page.goto(url.href).catch(() => {
      throw Error('Local recovery navigation failed');
    });
    await page.waitForURL(origin + '/en/password');
    await expect(page.locator('[name=password]')).toBeEditable();
  } finally {
    await ctx.close();
  }
}

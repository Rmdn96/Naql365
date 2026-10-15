import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const locale of ['ar', 'en']) {
  test(`${locale} semantic themes persist and follow system across public/auth widths`, async ({
    page,
  }) => {
    await page.goto(`/${locale}`);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'system');
    for (const mode of ['light', 'dark', 'system']) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page
        .getByLabel(locale === 'ar' ? 'المظهر' : 'Theme', { exact: true })
        .filter({ visible: true })
        .selectOption(mode);
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
      const initialHtml = await (await page.request.get(`/${locale}`)).text();
      expect(initialHtml).toContain(`data-theme="${mode}"`);
      for (const path of ['', '/login', '/register', '/recover', '/password']) {
        await page.goto(`/${locale}${path}`);
        for (const width of [360, 390, 768, 1280, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          ).toBe(true);
        }
        expect(
          (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
            .violations,
        ).toEqual([]);
      }
    }
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(11, 22, 37)');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(245, 247, 250)');
  });

  test(`${locale} market changes retain same-origin security and survive navigation`, async ({
    page,
  }) => {
    await page.goto(`/${locale}`);
    for (const country of ['EG', 'SA']) {
      const responsePromise = page.waitForResponse(
        (response) =>
          response.url().endsWith('/api/public/market') && response.request().method() === 'POST',
      );
      await page.locator('#public-market').selectOption(country);
      const response = await responsePromise;
      expect(response.status()).toBe(200);
      expect(response.request().headers().origin).toBe('http://127.0.0.1:3000');
      const setCookie = response.headers()['set-cookie'];
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toMatch(/SameSite=strict/i);
      expect(setCookie).toContain('Path=/');
      await expect(page.locator('#public-market')).toHaveValue(country);
      await page.reload();
      await expect(page.locator('#public-market')).toHaveValue(country);
      await page.goto(`/${locale === 'ar' ? 'en' : 'ar'}/login`);
      await expect(page.locator('#public-market')).toHaveValue(country);
      await page.goto(`/${locale}`);
    }
    const rejected = await page.request.post('/api/public/market', {
      headers: { Origin: 'https://unapproved.example' },
      data: { country: 'EG' },
    });
    expect(rejected.status()).toBe(403);
    expect(rejected.headers()['set-cookie']).toBeUndefined();
  });
}

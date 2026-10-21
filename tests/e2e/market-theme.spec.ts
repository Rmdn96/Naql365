import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const locale of ['ar', 'en'] as const) {
  test(`${locale} semantic themes persist and follow system across public/auth widths`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.goto(`/${locale}`);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'system');
    for (const mode of ['light', 'dark', 'system'] as const) {
      await page.goto(`/${locale}`);
      await page.setViewportSize({ width: 1440, height: 900 });
      const themeName = locale === 'ar' ? 'المظهر' : 'Appearance';
      const modeName =
        locale === 'ar'
          ? { light: 'فاتح', dark: 'داكن', system: 'تلقائي' }[mode]
          : { light: 'Light', dark: 'Dark', system: 'System' }[mode];
      const theme = page.getByRole('group', { name: themeName, exact: true });
      await theme.getByRole('button', { name: modeName, exact: true }).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
      await expect(theme.getByRole('button', { pressed: true })).toHaveCount(1);
      await expect(theme.getByRole('button', { name: modeName, exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await page.setViewportSize({ width: 390, height: 900 });
      await expect(theme.getByRole('button', { name: modeName, exact: true })).toBeVisible();
      const menu = page.getByRole('button', {
        name: locale === 'ar' ? 'القائمة' : 'Menu',
        exact: true,
      });
      await menu.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(menu).toBeFocused();
      await expect(theme.getByRole('button', { name: modeName, exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
      const initialHtml = await (await page.request.get(`/${locale}`)).text();
      expect(initialHtml).toContain(`data-theme="${mode}"`);
      for (const path of ['', '/login', '/register', '/recover', '/password']) {
        await page.goto(`/${locale}${path}`);
        await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
        if (path) {
          const controls = page.getByLabel(locale === 'ar' ? 'المظهر' : 'Theme', { exact: true });
          await expect
            .poll(() =>
              controls.evaluateAll((items) =>
                items.map((item) => (item as HTMLSelectElement).value),
              ),
            )
            .toEqual([mode, mode]);
        }
        for (const width of [360, 390, 768, 1280, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          ).toBe(true);
          if (width === 360 || width === 1440) {
            expect(
              (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
                .violations,
            ).toEqual([]);
          }
        }
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
      await page
        .getByRole('combobox', { name: /^(Service country|بلد الخدمة)$/, exact: true })
        .selectOption(country);
      const response = await responsePromise;
      expect(response.status()).toBe(200);
      expect((await response.request().allHeaders()).origin).toBe('http://127.0.0.1:3000');
      const setCookie = (await response.allHeaders())['set-cookie'] ?? '';
      // Playwright's synchronous headers() omits security headers; assert only safe flags.
      expect(/(?:^|;)\s*HttpOnly(?:;|$)/i.test(setCookie)).toBe(true);
      expect(/(?:^|;)\s*SameSite=strict(?:;|$)/i.test(setCookie)).toBe(true);
      expect(/(?:^|;)\s*Path=\/(?:;|$)/i.test(setCookie)).toBe(true);
      await expect(
        page.getByRole('combobox', { name: /^(Service country|بلد الخدمة)$/, exact: true }),
      ).toHaveValue(country);
      await page.reload();
      await expect(
        page.getByRole('combobox', { name: /^(Service country|بلد الخدمة)$/, exact: true }),
      ).toHaveValue(country);
      await page.goto(`/${locale === 'ar' ? 'en' : 'ar'}/login`);
      await expect(
        page.getByRole('combobox', { name: /^(Service country|بلد الخدمة)$/, exact: true }),
      ).toHaveValue(country);
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

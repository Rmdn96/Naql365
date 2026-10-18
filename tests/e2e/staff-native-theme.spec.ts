import { expect, test } from '@playwright/test';

for (const locale of ['ar', 'en']) {
  test(`${locale} staff native date picker follows explicit and system themes without changing its value`, async ({
    page,
  }) => {
    await page.goto(`/${locale}/login`);
    // CSS regression fixture only. This does not enter a protected portal,
    // authenticate, authorize an action or represent hosted business acceptance.
    await page.locator('main').evaluate((main) => {
      const fixture = document.createElement('div');
      fixture.className = 'staff-app';
      fixture.id = 'native-theme-fixture';
      const field = document.createElement('div');
      const label = document.createElement('label');
      label.htmlFor = 'native-theme-date';
      label.textContent = 'Test-owned native date';
      const input = document.createElement('input');
      input.type = 'datetime-local';
      input.id = 'native-theme-date';
      input.required = true;
      input.value = '2026-10-16T10:00';
      field.append(label, input);
      fixture.append(field);
      main.append(fixture);
    });
    const input = page.locator('#native-theme-date');
    for (const [mode, system, dark] of [
      ['light', 'dark', false],
      ['dark', 'light', true],
      ['system', 'dark', true],
      ['system', 'light', false],
    ] as const) {
      await page.emulateMedia({ colorScheme: system });
      await page.evaluate((mode) => {
        document.documentElement.dataset.theme = mode;
      }, mode);
      if (dark) await expect(input).toHaveCSS('color-scheme', 'dark');
      else await expect(input).not.toHaveCSS('color-scheme', 'dark');
      await expect(input).toHaveValue('2026-10-16T10:00');
      expect(await input.evaluate((element) => (element as HTMLInputElement).checkValidity())).toBe(
        true,
      );
    }
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
  });
}

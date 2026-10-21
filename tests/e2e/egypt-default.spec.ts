import { expect, test } from '@playwright/test';

for (const locale of ['ar', 'en']) {
  test(`${locale} fresh public visitor defaults to Egypt and retains an explicit preference`, async ({
    page,
  }) => {
    await page.goto(`/${locale}`);
    await expect(
      page.getByRole('combobox', { name: /^(Service country|بلد الخدمة)$/, exact: true }),
    ).toHaveValue('EG');
    await page.reload();
    await expect(
      page.getByRole('combobox', { name: /^(Service country|بلد الخدمة)$/, exact: true }),
    ).toHaveValue('EG');
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().endsWith('/api/public/market') &&
          response.request().method() === 'POST' &&
          response.status() === 200,
      ),
      page
        .getByRole('combobox', { name: /^(Service country|بلد الخدمة)$/, exact: true })
        .selectOption('SA'),
    ]);
    await expect(
      page.getByRole('combobox', { name: /^(Service country|بلد الخدمة)$/, exact: true }),
    ).toHaveValue('SA');
    await page.goto(`/${locale === 'ar' ? 'en' : 'ar'}/login`);
    await expect(
      page.getByRole('combobox', { name: /^(Service country|بلد الخدمة)$/, exact: true }),
    ).toHaveValue('SA');
    await page.reload();
    await expect(
      page.getByRole('combobox', { name: /^(Service country|بلد الخدمة)$/, exact: true }),
    ).toHaveValue('SA');
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().endsWith('/api/public/market') &&
          response.request().method() === 'POST' &&
          response.status() === 200,
      ),
      page
        .getByRole('combobox', { name: /^(Service country|بلد الخدمة)$/, exact: true })
        .selectOption('EG'),
    ]);
    await expect(
      page.getByRole('combobox', { name: /^(Service country|بلد الخدمة)$/, exact: true }),
    ).toHaveValue('EG');
  });
}

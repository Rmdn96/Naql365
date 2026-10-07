import { test, expect } from '../staging/fixtures';
import { login, axe } from '../phase4/helpers';
import { stage1Capture } from '../helpers/stage1-evidence';
import { dictionary } from '../../src/i18n/dictionaries';
for (const locale of ['ar', 'en'] as const) {
  test(`${locale} normal SUPER_ADMIN session, explicit logout and history denial`, async ({
    page,
  }) => {
    await login(page, 'bankAdmin', locale);
    await page.goto(`/${locale}/portal/operations`);
    await axe(page);
    await stage1Capture(page, `operations-${locale}`);
    for (const route of ['', '#services', '#how']) {
      await page.goto(`/${locale}${route}`);
      await expect(page.locator('.desktop-header-nav .identity-link')).toHaveAttribute(
        'href',
        `/${locale}/portal`,
      );
    }
    await page.goto(`/${locale}/login`);
    await expect(page).toHaveURL(new RegExp(`/${locale}/portal$`));
    await page.reload();
    await page.getByRole('button', { name: dictionary(locale).logout, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/login$`));
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/${locale}/login$`));
    await page.goto(`/${locale}/portal/operations`);
    await expect(page).toHaveURL(new RegExp(`/${locale}/login$`));
  });
}

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const locale of ['ar', 'en'] as const) {
  test(`${locale} customer payment explanation and secure continuation remain accessible`, async ({
    page,
  }) => {
    await page.goto(`/${locale}`);
    const payment = page.getByRole('region', {
      name: locale === 'ar' ? 'الدفع بوضوح' : 'Payment, explained',
      exact: true,
    });
    await expect(payment).toBeVisible();
    await expect(payment).toContainText(
      locale === 'ar' ? 'انتظر تأكيد المالية' : 'wait for Finance confirmation',
    );
    await expect(payment).not.toContainText(/IBAN|SA\d{22}|sb_secret_/);
    await expect(payment).toContainText('CASH');
    await expect(payment).toContainText(
      locale === 'ar' ? 'فودافون كاش وإنستاباي' : 'Vodafone Cash and InstaPay',
    );
    await expect(payment).toContainText(
      locale === 'ar'
        ? 'رفع إثبات الدفع لا يؤكد استلام الأموال'
        : 'Uploading payment proof does not confirm receipt of funds',
    );
    await expect(payment).toContainText(
      locale === 'ar' ? 'التحقق اليدوي' : 'manual verification of actual receipt',
    );
    await expect(payment).toContainText(locale === 'ar' ? 'يحدد عرض السعر يدويًا' : 'manual quote');
    await expect(payment).toContainText(
      locale === 'ar' ? 'اقبل العرض النهائي' : 'Accept the final quote',
    );
    await expect(payment).toContainText(
      locale === 'ar'
        ? 'تقرير المورد وحده لا يؤكد التحصيل'
        : 'a supplier report alone does not confirm collection',
    );
    for (const width of [360, 390, 768, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await payment
      .getByRole('link', {
        name: locale === 'ar' ? 'متابعة طلب قائم' : 'Track an existing request',
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/guest$`));
    await expect(page.locator('main').getByRole('alert')).toBeVisible();
    await expect(page.locator('main input')).toHaveCount(0);
    await expect(page).toHaveTitle(/Naql365|نقل/);
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
  });
}

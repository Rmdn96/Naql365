import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
for (const locale of ['ar', 'en']) {
  test('paused storefront, legacy links and cart · ' + locale, async ({ page }) => {
    await page.goto('/' + locale + '/store/categories?search=boxes');
    await expect(page).toHaveURL(
      (url) => url.pathname === '/' + locale && url.searchParams.get('search') === 'boxes',
    );
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      locale === 'ar' ? 'متجر نقل 365' : 'Naql365 Store',
    );
    await expect(
      page.getByRole('status').filter({
        hasText: locale === 'ar' ? 'الشراء متوقف' : 'Purchasing is currently unavailable',
      }),
    ).toBeVisible();
    await expect(page.locator('.store-product')).toHaveCount(0);
    const navigation = page.locator('.launch-main-nav');
    await expect(navigation.getByRole('link')).toHaveCount(4);
    for (const path of ['', '/store/cart', '/request', '#contact']) {
      await expect(navigation.locator('a[href="/' + locale + path + '"]')).toBeVisible();
    }
    await navigation.locator('a[href$="#contact"]').click();
    await expect(page.locator('#contact a[href^="tel:"]')).toBeVisible();
    await expect(page.locator('#contact a[href^="https://wa.me/"]')).toBeVisible();
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      await expect(page.getByRole('searchbox')).toBeVisible();
    }
    expect(
      (await new AxeBuilder({ page }).include('.store-experience').analyze()).violations,
    ).toEqual([]);
    await page.goto('/' + locale + '/store/checkout');
    await expect(page).toHaveURL(new RegExp('/' + locale + '/store/cart$'));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      locale === 'ar' ? 'السلة وإتمام الطلب' : 'Cart and checkout',
    );
    await expect(page.locator('#guest-checkout')).toHaveCount(0);
  });
}

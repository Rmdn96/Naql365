import { test, expect } from '../staging/fixtures';
import { axe } from '../phase4/helpers';
import { publicDictionary } from '../../src/i18n/public';

for (const locale of ['ar', 'en'] as const) {
  test(`${locale} hosted public MVP responsive accessibility, SEO and market contact`, async ({
    page,
  }) => {
    const t = publicDictionary(locale);
    const response = await page.goto(`/${locale}`);
    expect(response?.headers()['content-security-policy']).toContain("object-src 'none'");
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    await expect(page.locator('link[rel="alternate"][hreflang="ar"]')).toHaveCount(1);
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(1);
    expect(await page.title()).toContain('Naql365');
    for (const country of ['SA', 'EG']) {
      await page.getByLabel(t.country).selectOption(country);
      await expect(page.locator('.floating-contact')).toHaveAttribute(
        'href',
        new RegExp(`^https://wa.me/${country === 'SA' ? '966558985250' : '201009402374'}\\?`),
      );
      for (const width of [360, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await axe(page);
      }
      expect(await page.locator('#quick-service option').count()).toBeGreaterThan(1);
      expect(await page.locator('body').innerText()).not.toMatch(/IBAN|InstaPay|Vodafone Cash/);
    }
    // Only public content is captured; secure journeys never produce screenshots.
    if (process.env.STAGING_PHASE7_PUBLIC_SCREENSHOTS) {
      await page.screenshot({
        path: `${process.env.STAGING_PHASE7_PUBLIC_SCREENSHOTS}/${locale}-desktop.png`,
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({
        path: `${process.env.STAGING_PHASE7_PUBLIC_SCREENSHOTS}/${locale}-mobile.png`,
        fullPage: true,
      });
    }
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
    const resources = await page.evaluate(
      async (locale) =>
        Promise.all(
          ['/robots.txt', '/sitemap.xml', `/${locale}/legal/privacy`].map(async (path) => {
            const response = await fetch(path);
            return { status: response.status, text: await response.text() };
          }),
        ),
      locale,
    );
    expect(resources[0]!.status).toBe(200);
    expect(resources[0]!.text).toMatch(/Disallow: \/\s/);
    expect(resources[1]!.status).toBe(200);
    expect(resources[1]!.text).not.toContain('/guest');
    expect(resources[2]!.status).toBe(404);
  });
}

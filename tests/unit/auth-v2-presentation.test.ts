import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { AuthExperience } from '@/components/auth/auth-experience';
import { PasswordField } from '@/components/auth/password-field';

for (const locale of ['ar', 'en'] as const) {
  it(`${locale} auth layout supplies one labelled main title and keeps caller feedback`, () => {
    const props = {
      locale,
      title: 'Synthetic title',
      intro: 'Synthetic guidance',
      children: createElement('div', { role: 'alert' }, 'Safe server error'),
    };
    const html = renderToStaticMarkup(createElement(AuthExperience, props));
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('aria-labelledby="auth-v2-title"');
    expect(html).toContain('role="alert"');
    expect(html).toContain(`href="/${locale}"`);
    expect(html).not.toMatch(/<form|<input|script|token=/);
  });
  it(`${locale} password presentation preserves login and new-password field contracts`, () => {
    for (const login of [true, false]) {
      const html = renderToStaticMarkup(
        createElement(PasswordField, { locale, label: 'Password', login }),
      );
      expect(html).toContain('type="password"');
      expect(html).toContain('name="password"');
      expect(html).toContain(`minLength="${login ? 1 : 12}"`);
      expect(html).toContain(`autoComplete="${login ? 'current-password' : 'new-password'}"`);
      expect(html).toContain('maxLength="128"');
      expect(html).toContain('type="button"');
      expect(html).toContain('aria-controls="password"');
      expect(html).toContain('aria-pressed="false"');
      expect(html).not.toContain('value=');
    }
  });
}

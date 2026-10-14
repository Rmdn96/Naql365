import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import type { AuthState } from '@/app/auth/customer-actions';
const presentation = vi.hoisted(() => ({ state: { status: 'idle' } as AuthState, pending: false }));
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useActionState: () => [presentation.state, () => undefined, presentation.pending],
}));
vi.mock('@/app/auth/customer-actions', () => ({ customerAuth: vi.fn(), customerProfile: vi.fn() }));
import { CustomerAuthForm } from '@/components/auth/customer-form';
import { authErrorMessage } from '@/i18n/auth-errors';
import { customerDictionary } from '@/i18n/customer';

it('view renders existing server errors, non-enumerating sent feedback and busy actions without manufacturing successful authentication', () => {
  for (const locale of ['ar', 'en'] as const) {
    for (const code of ['server', 'credentials', 'confirmation', 'validation']) {
      presentation.state = { status: 'error', code };
      presentation.pending = false;
      const html = renderToStaticMarkup(createElement(CustomerAuthForm, { locale, mode: 'login' }));
      expect(html).toContain(authErrorMessage(locale, code));
      expect(html).toContain('role="alert"');
      expect(html).not.toContain('value="Synthetic');
    }
    for (const mode of ['register', 'recover'] as const) {
      presentation.state = { status: 'sent' };
      const html = renderToStaticMarkup(createElement(CustomerAuthForm, { locale, mode }));
      expect(html).toContain(customerDictionary(locale).sent);
      expect(html).toContain('role="status"');
    }
    presentation.state = { status: 'idle' };
    presentation.pending = true;
    const html = renderToStaticMarkup(createElement(CustomerAuthForm, { locale, mode: 'login' }));
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('type="submit" disabled=""');
    expect(html).toContain(customerDictionary(locale).loading);
  }
});

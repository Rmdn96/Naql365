'use client';
import { useActionState } from 'react';
import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import { customerDictionary } from '@/i18n/customer';
import { customerAuth, customerProfile, type AuthState } from '@/app/auth/customer-actions';
import { Input, Button, Alert, Select } from '@/components/ui/primitives';
const initial: AuthState = { status: 'idle' };
export function CustomerAuthForm({
  locale,
  mode,
}: {
  locale: Locale;
  mode: 'login' | 'register' | 'recover' | 'password';
}) {
  const t = customerDictionary(locale);
  const [state, action, pending] = useActionState(customerAuth.bind(null, locale, mode), initial);
  return (
    <>
      <form action={action} className="stack">
        {mode !== 'password' && (
          <Input
            id="email"
            label={t.email}
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            dir="ltr"
          />
        )}
        {mode !== 'recover' && (
          <>
            <Input
              id="password"
              label={t.password}
              name="password"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            <small>{t.passwordHint}</small>
          </>
        )}
        {state.status === 'error' && <Alert tone="error">{t.authError}</Alert>}
        {state.status === 'sent' && <Alert tone="success">{t.sent}</Alert>}
        <Button disabled={pending}>
          {pending
            ? t.loading
            : mode === 'login'
              ? t.login
              : mode === 'register'
                ? t.register
                : mode === 'password'
                  ? t.passwordTitle
                  : t.send}
        </Button>
      </form>
      <nav className="customer-links" aria-label={t.account}>
        {mode !== 'login' && <Link href={`/${locale}/login`}>{t.login}</Link>}
        {mode !== 'register' && <Link href={`/${locale}/register`}>{t.register}</Link>}
        {mode !== 'recover' && <Link href={`/${locale}/recover`}>{t.recover}</Link>}
      </nav>
    </>
  );
}
export function CustomerProfileForm({
  locale,
  profile,
}: {
  locale: Locale;
  profile: { display_name: string | null; phone: string | null; locale: string };
}) {
  const t = customerDictionary(locale);
  const [state, action, pending] = useActionState(customerProfile.bind(null, locale), initial);
  return (
    <form action={action} className="stack">
      <Input
        id="name"
        name="name"
        label={t.name}
        defaultValue={profile.display_name ?? ''}
        required
        maxLength={200}
        autoComplete="name"
      />
      <Input
        id="phone"
        name="phone"
        label={t.phone}
        defaultValue={profile.phone ?? ''}
        required
        maxLength={24}
        autoComplete="tel"
        type="tel"
        dir="ltr"
      />
      <small>{t.phoneHint}</small>
      <Select id="locale" name="locale" label={t.locale} defaultValue={profile.locale}>
        <option value="ar">العربية</option>
        <option value="en">English</option>
      </Select>
      {state.status === 'error' && <Alert tone="error">{t.authError}</Alert>}
      <Button disabled={pending}>{pending ? t.saving : t.saveProfile}</Button>
    </form>
  );
}

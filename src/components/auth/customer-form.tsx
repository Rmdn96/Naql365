'use client';
import { customerExperience } from '@/i18n/customer-experience';
import { useActionState, useState } from 'react';
import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import { customerDictionary } from '@/i18n/customer';
import { authErrorMessage } from '@/i18n/auth-errors';
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
  const [email, setEmail] = useState('');
  return (
    <>
      <form action={action} className="stack auth-form" aria-busy={pending}>
        {mode !== 'password' && (
          <Input
            id="email"
            label={t.email}
            name="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
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
              minLength={mode === 'login' ? 1 : 12}
              maxLength={128}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            {mode !== 'login' && <small>{t.passwordHint}</small>}
          </>
        )}
        {state.status === 'error' && (
          <Alert tone="error">{authErrorMessage(locale, state.code)}</Alert>
        )}
        {state.status === 'sent' && (
          <Alert tone="success">
            <strong>{t.sent}</strong>
            <p>
              {locale === 'ar'
                ? 'افتح بريدك واتبع الرابط لإكمال الخطوة. تحقق من البريد غير المرغوب فيه، ثم عُد لتسجيل الدخول. لا تشارك رابط التأكيد.'
                : 'Open your inbox and follow the link to continue. Check your spam folder, then return to sign in. Keep the confirmation link private.'}
            </p>
          </Alert>
        )}
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
      {mode === 'register' && (
        <p className="auth-alternative">
          <Link href={`/${locale}/request`}>
            {customerExperience(locale).requestWithoutAccount}
          </Link>
        </p>
      )}
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
  const [name, setName] = useState(profile.display_name ?? '');
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [preferredLocale, setPreferredLocale] = useState(profile.locale);
  return (
    <form action={action} className="stack profile-form" aria-busy={pending}>
      <p className="muted">{customerExperience(locale).profileHelp}</p>
      <Input
        id="name"
        name="name"
        label={t.name}
        error={state.fields?.includes('name') ? t.profileNameError : ''}
        value={name}
        onChange={(event) => setName(event.target.value)}
        required
        maxLength={200}
        autoComplete="name"
      />
      <Input
        id="phone"
        name="phone"
        label={t.phone}
        error={state.fields?.includes('phone') ? t.phoneHint : ''}
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        required
        maxLength={24}
        autoComplete="tel"
        type="tel"
        dir="ltr"
      />
      <small>{t.phoneHint}</small>
      <Select
        id="locale"
        name="locale"
        label={t.locale}
        value={preferredLocale}
        onChange={(event) => setPreferredLocale(event.target.value)}
      >
        <option value="ar">العربية</option>
        <option value="en">English</option>
      </Select>
      {state.status === 'error' && (
        <Alert tone="error">
          {state.code === 'validation' ? t.profileValidation : t.profileSaveError}
        </Alert>
      )}
      <Button disabled={pending}>{pending ? t.saving : t.saveProfile}</Button>
    </form>
  );
}

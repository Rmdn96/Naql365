'use client';
import { useActionState } from 'react';
import type { Locale } from '@/i18n/config';
import { customerDictionary } from '@/i18n/customer';
import { driverLogin } from '@/app/auth/driver-actions';
import { Input, Button, Alert } from '@/components/ui/primitives';
export function DriverLogin({ locale }: { locale: Locale }) {
  const t = customerDictionary(locale),
    [state, action, pending] = useActionState(driverLogin.bind(null, locale), { error: false });
  return (
    <form action={action} className="stack">
      <Input
        id="driver-email"
        name="email"
        label={t.email}
        type="email"
        autoComplete="email"
        dir="ltr"
        required
        maxLength={254}
      />
      <Input
        id="driver-password"
        name="password"
        label={t.password}
        type="password"
        autoComplete="current-password"
        required
        minLength={12}
        maxLength={128}
      />
      {state.error && <Alert tone="error">{t.authError}</Alert>}
      <Button disabled={pending}>{pending ? t.loading : t.login}</Button>
    </form>
  );
}

'use client';
import { useActionState } from 'react';
import type { Locale } from '@/i18n/config';
import { dictionary } from '@/i18n/dictionaries';
import { smokeLogin } from '@/app/auth/actions';
import { Alert, Button, Input } from '@/components/ui/primitives';

export function SmokeLoginForm({ locale }: { locale: Locale }) {
  const t = dictionary(locale);
  const [state, action, pending] = useActionState(smokeLogin.bind(null, locale), { failed: false });
  return (
    <form action={action} className="stack" aria-label={t.login}>
      <p>{t.stagingAuthNotice}</p>
      <Input
        id="email"
        name="email"
        type="email"
        label={t.email}
        autoComplete="username"
        maxLength={254}
        required
      />
      <Input
        id="password"
        name="password"
        type="password"
        label={t.password}
        autoComplete="current-password"
        minLength={12}
        maxLength={128}
        required
      />
      {state.failed && <Alert tone="error">{t.loginFailed}</Alert>}
      <Button type="submit" disabled={pending}>
        {pending ? t.loading : t.login}
      </Button>
    </form>
  );
}

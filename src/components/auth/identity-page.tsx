import { redirect } from 'next/navigation';
import type { Locale } from '@/i18n/config';
import { customerDictionary } from '@/i18n/customer';
import { CustomerAuthForm } from './customer-form';
import { Card, Alert } from '@/components/ui/primitives';
import { getPublicEnv } from '@/infrastructure/config/public-env';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server';
export async function IdentityPage({
  locale,
  mode,
}: {
  locale: Locale;
  mode: 'register' | 'recover' | 'password';
}) {
  const t = customerDictionary(locale);
  if (!getPublicEnv())
    return (
      <div className="container page narrow">
        <Alert>{t.error}</Alert>
      </div>
    );
  if (mode === 'password') {
    const client = await createSupabaseServerClient();
    const { data } = await client.auth.getUser();
    if (!data.user) redirect(`/${locale}/login`);
  }
  return (
    <div className="container page narrow">
      <Card>
        <h1>{mode === 'password' ? t.passwordTitle : t[mode]}</h1>
        <CustomerAuthForm locale={locale} mode={mode} />
      </Card>
    </div>
  );
}

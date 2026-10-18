import { AuthExperience } from './auth-experience';
import { customerExperience } from '@/i18n/customer-experience';
import { redirect } from 'next/navigation';
import type { Locale } from '@/i18n/config';
import { customerDictionary } from '@/i18n/customer';
import { CustomerAuthForm } from './customer-form';
import { Alert } from '@/components/ui/primitives';
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
      <AuthExperience
        locale={locale}
        title={mode === 'password' ? t.passwordTitle : t[mode]}
        intro={
          mode === 'register'
            ? customerExperience(locale).registerHelp
            : mode === 'password'
              ? locale === 'ar'
                ? 'اختر كلمة مرور جديدة من 12 حرفًا على الأقل. بعد الحفظ، سجّل الدخول من جديد.'
                : 'Choose a new password with at least 12 characters. Sign in again after saving.'
              : customerExperience(locale).recoveryHelp
        }
      >
        <Alert>{t.error}</Alert>
      </AuthExperience>
    );
  if (mode === 'password') {
    const client = await createSupabaseServerClient();
    const { data } = await client.auth.getUser();
    if (!data.user) redirect(`/${locale}/login`);
  }
  return (
    <AuthExperience
      locale={locale}
      title={mode === 'password' ? t.passwordTitle : t[mode]}
      intro={
        mode === 'register'
          ? customerExperience(locale).registerHelp
          : mode === 'password'
            ? locale === 'ar'
              ? 'اختر كلمة مرور جديدة من 12 حرفًا على الأقل. بعد الحفظ، سجّل الدخول من جديد.'
              : 'Choose a new password with at least 12 characters. Sign in again after saving.'
            : customerExperience(locale).recoveryHelp
      }
    >
      <CustomerAuthForm locale={locale} mode={mode} />
    </AuthExperience>
  );
}

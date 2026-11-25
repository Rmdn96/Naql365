import { AuthExperience } from '@/components/auth/auth-experience';
import { authErrorMessage } from '@/i18n/auth-errors';
import { customerExperience } from '@/i18n/customer-experience';
import { notFound, redirect } from 'next/navigation';
import { loginDestination } from '@/infrastructure/identity/login-destination';
import { isLocale } from '@/i18n/config';
import { dictionary } from '@/i18n/dictionaries';
import { Badge, Alert } from '@/components/ui/primitives';
import { commercialAdminOnly, stagingAuthEnabled } from '@/infrastructure/config/deployment-env';
import { SmokeLoginForm } from '@/components/auth/smoke-login-form';
import { CustomerAuthForm } from '@/components/auth/customer-form';
import { getPublicEnv } from '@/infrastructure/config/public-env';
export const metadata = { robots: { index: false, follow: false } };
export default async function Login({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ notice?: string | string[] }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const adminOnly = commercialAdminOnly();
  if (getPublicEnv()) {
    const destination = await loginDestination();
    if (destination === 'portal') redirect(`/${locale}/portal`);
    if (!adminOnly && destination !== 'unauthenticated') {
      const route = ['account', 'portal', 'driver'].includes(destination)
        ? destination
        : 'auth-complete';
      redirect(`/${locale}/${route}`);
    }
  }
  const t = dictionary(locale);
  const notice = (await searchParams).notice;
  return (
    <AuthExperience
      locale={locale}
      title={adminOnly ? (locale === 'ar' ? 'دخول الإدارة' : 'Administrator sign in') : t.login}
      intro={
        adminOnly
          ? locale === 'ar'
            ? 'سجّل الدخول لإدارة Naql365.'
            : 'Sign in to manage Naql365.'
          : customerExperience(locale).loginHelp
      }
    >
      {!getPublicEnv() && <Badge>{t.foundation}</Badge>}
      {notice === 'confirmation-link' && (
        <Alert tone="error">{authErrorMessage(locale, 'confirmationLink')}</Alert>
      )}
      {getPublicEnv() ? (
        <CustomerAuthForm locale={locale} mode="login" adminOnly={adminOnly} />
      ) : stagingAuthEnabled() ? (
        <SmokeLoginForm locale={locale} />
      ) : (
        <p>{t.authBody}</p>
      )}
    </AuthExperience>
  );
}

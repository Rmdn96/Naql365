import { customerExperience } from '@/i18n/customer-experience';
import { notFound, redirect } from 'next/navigation';
import { loginDestination } from '@/infrastructure/identity/login-destination';
import { isLocale } from '@/i18n/config';
import { dictionary } from '@/i18n/dictionaries';
import { Card, Badge } from '@/components/ui/primitives';
import { stagingAuthEnabled } from '@/infrastructure/config/deployment-env';
import { SmokeLoginForm } from '@/components/auth/smoke-login-form';
import { CustomerAuthForm } from '@/components/auth/customer-form';
import { getPublicEnv } from '@/infrastructure/config/public-env';
export const metadata = { robots: { index: false, follow: false } };
export default async function Login({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  if (getPublicEnv()) {
    const destination = await loginDestination();
    if (destination !== 'unauthenticated') {
      const route = ['account', 'portal', 'driver'].includes(destination)
        ? destination
        : 'auth-complete';
      redirect(`/${locale}/${route}`);
    }
  }
  const t = dictionary(locale);
  return (
    <div className="container page narrow customer-experience">
      <Card className="auth-card">
        {!getPublicEnv() && <Badge>{t.foundation}</Badge>}
        <h1>{t.login}</h1>
        <p className="auth-intro">{customerExperience(locale).loginHelp}</p>
        {getPublicEnv() ? (
          <CustomerAuthForm locale={locale} mode="login" />
        ) : stagingAuthEnabled() ? (
          <SmokeLoginForm locale={locale} />
        ) : (
          <p>{t.authBody}</p>
        )}
      </Card>
    </div>
  );
}

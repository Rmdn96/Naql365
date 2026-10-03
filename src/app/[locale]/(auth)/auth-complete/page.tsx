import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { authErrorMessage } from '@/i18n/auth-errors';
import { loginDestination } from '@/infrastructure/identity/login-destination';
import { customerLogout } from '@/app/auth/customer-actions';
import { customerDictionary } from '@/i18n/customer';
import { Alert, Button, Card } from '@/components/ui/primitives';

export const metadata = { robots: { index: false, follow: false } };
export default async function AuthComplete({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const destination = await loginDestination();
  if (destination === 'unauthenticated') redirect(`/${locale}/login`);
  if (['account', 'portal', 'driver'].includes(destination)) redirect(`/${locale}/${destination}`);
  const t = customerDictionary(locale);
  return (
    <div className="container page narrow">
      <Card>
        <h1>{t.login}</h1>
        <Alert tone="error">{authErrorMessage(locale, destination)}</Alert>
        <Link href={`/${locale}/auth-complete`}>
          {locale === 'ar' ? 'إعادة المحاولة' : 'Retry'}
        </Link>
        <form action={customerLogout.bind(null, locale)}>
          <Button>{t.logout}</Button>
        </form>
      </Card>
    </div>
  );
}

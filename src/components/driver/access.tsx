import { redirect } from 'next/navigation';
import type { Locale } from '@/i18n/config';
import { dictionary } from '@/i18n/dictionaries';
import { AppError } from '@/domain/shared/errors';
import { Alert, Button } from '@/components/ui/primitives';
import { driverLogout } from '@/app/auth/driver-actions';
export function DriverAccessError({ error, locale }: { error: unknown; locale: Locale }) {
  const t = dictionary(locale);
  if (error instanceof AppError && error.code === 'unauthenticated')
    redirect(`/${locale}/driver/login`);
  const denied = error instanceof AppError && error.code === 'forbidden';
  return (
    <div className="container page narrow">
      <Alert tone="error">
        <h1>{denied ? t.unauthorized : t.unavailable}</h1>
        <p>{denied ? t.unauthorizedBody : t.unavailableBody}</p>
      </Alert>
      {denied && (
        <form action={driverLogout.bind(null, locale)}>
          <Button>{t.logout}</Button>
        </form>
      )}
    </div>
  );
}

import { redirect } from 'next/navigation';
import { dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { portalAccess } from '@/infrastructure/identity/access';
import { Card, Alert, EmptyState, Button } from '@/components/ui/primitives';
import { stagingAuthEnabled } from '@/infrastructure/config/deployment-env';
import { smokeLogout } from '@/app/auth/actions';

export async function ProtectedShell({
  locale,
  portal,
}: {
  locale: Locale;
  portal: 'account' | 'portal' | 'driver';
}) {
  const t = dictionary(locale);
  const result = await portalAccess(`${portal}.access`);
  if (result.status === 'unauthenticated') redirect(`/${locale}/login`);
  if (result.status === 'unconfigured')
    return (
      <div className="container page narrow">
        <Alert>
          <h1>{t.unavailable}</h1>
          <p>{t.unavailableBody}</p>
        </Alert>
      </div>
    );
  if (result.status === 'forbidden')
    return (
      <div className="container page narrow">
        <Alert tone="error">
          <h1>{t.unauthorized}</h1>
          <p>{t.unauthorizedBody}</p>
        </Alert>
        {stagingAuthEnabled() && (
          <form action={smokeLogout.bind(null, locale)}>
            <Button variant="secondary">{t.logout}</Button>
          </form>
        )}
      </div>
    );
  return (
    <div className="container page">
      <Card>
        <h1>{t[portal]}</h1>
        <p>{t.protectedBody}</p>
        <EmptyState title={t.empty}>{t.emptyBody}</EmptyState>
        {stagingAuthEnabled() && (
          <form action={smokeLogout.bind(null, locale)}>
            <Button variant="secondary">{t.logout}</Button>
          </form>
        )}
      </Card>
    </div>
  );
}

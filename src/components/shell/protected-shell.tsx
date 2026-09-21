import { redirect } from 'next/navigation';
import { dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { portalAccess } from '@/infrastructure/identity/access';
import { Card, Alert, EmptyState, Button } from '@/components/ui/primitives';
import { stagingAuthEnabled } from '@/infrastructure/config/deployment-env';
import { smokeLogout } from '@/app/auth/actions';
import Link from 'next/link';
import { quotesDictionary } from '@/i18n/quotes';
import { operationsDictionary } from '@/i18n/operations';
import { paymentDictionary } from '@/i18n/payments';

export async function ProtectedShell({
  locale,
  portal,
}: {
  locale: Locale;
  portal: 'account' | 'portal' | 'driver';
}) {
  const t = dictionary(locale);
  const qt = quotesDictionary(locale);
  const result = await portalAccess(`${portal}.access`);
  const pricingAccess = portal === 'portal' ? await portalAccess('pricing.calculate') : null;
  const operationsAccess = portal === 'portal' ? await portalAccess('operations.manage') : null;
  const financeAccess = portal === 'portal' ? await portalAccess('finance.read') : null;
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
        {financeAccess?.status === 'authorized' && (
          <p>
            <Link className="button button--primary" href={`/${locale}/portal/finance`}>
              {paymentDictionary(locale).finance}
            </Link>
          </p>
        )}
        {operationsAccess?.status === 'authorized' && (
          <p>
            <Link className="button button--primary" href={`/${locale}/portal/operations`}>
              {operationsDictionary(locale).title}
            </Link>
          </p>
        )}
        {pricingAccess?.status === 'authorized' && (
          <p>
            <Link className="button button--primary" href={`/${locale}/portal/quotes`}>
              {qt.salesQuotes}
            </Link>
          </p>
        )}
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

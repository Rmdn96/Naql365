import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { paymentDictionary } from '@/i18n/payments';
import { getBankConfiguration } from '@/infrastructure/payments/service';
import { portalAccess } from '@/infrastructure/identity/access';
import { BankForm } from '@/components/payments/bank-admin';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const access = await portalAccess('finance.accounts.manage');
  if (access.status === 'unauthenticated') redirect(`/${locale}/login`);
  if (access.status !== 'authorized') notFound();
  const organizationId = access.principal.organizationId,
    data = await getBankConfiguration(organizationId);
  return (
    <div className="container page">
      <h1>{paymentDictionary(locale).bankAdmin}</h1>
      {data.banks.map((b) => (
        <BankForm
          key={`${b.id}-${b.revision}`}
          locale={locale}
          organizationId={organizationId}
          markets={data.markets}
          existing={{
            id: b.id,
            revision: b.revision,
            marketId: b.market_id,
            details: {
              bankNameAr: b.bank_name_ar,
              bankNameEn: b.bank_name_en,
              beneficiaryAr: b.beneficiary_ar,
              beneficiaryEn: b.beneficiary_en,
              iban: b.iban ?? '',
              accountNumber: b.account_number ?? '',
              bic: b.bic ?? '',
              instructionsAr: b.instructions_ar,
              instructionsEn: b.instructions_en,
              active: b.active,
              primary: b.is_primary,
            },
          }}
        />
      ))}
      <BankForm
        key={`new-${data.banks.length}`}
        locale={locale}
        organizationId={organizationId}
        markets={data.markets}
      />
    </div>
  );
}

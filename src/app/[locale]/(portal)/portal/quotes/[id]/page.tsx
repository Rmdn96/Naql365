import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { quotesDictionary } from '@/i18n/quotes';
import { salesRequestDetails } from '@/infrastructure/pricing/service';
import { AppError } from '@/domain/shared/errors';
import { RequestSummary } from '@/components/requests/summary';
import { SalesPricing } from '@/components/pricing/sales-pricing';
import type { RequestDraft } from '@/domain/requests/intake';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const t = quotesDictionary(locale);
  let details;
  try {
    details = await salesRequestDetails(id);
  } catch (error) {
    if (error instanceof AppError && error.code === 'unauthenticated') redirect(`/${locale}/login`);
    if (error instanceof AppError && (error.code === 'forbidden' || error.code === 'not_found'))
      notFound();
    throw error;
  }
  const latest = details.evaluations[0];
  const versions = details.request.quotes.flatMap((q) => q.quote_versions);
  const draft = versions.find((v) => v.status === 'DRAFT');
  const locations = details.request.request_locations;
  const payload: RequestDraft = {
    service_id: '',
    description: details.request.description,
    notes: details.request.notes,
    preferred_date: '',
    time_window: '',
    contact_name: details.request.contact_name,
    contact_phone: details.request.contact_phone,
    contact_email: details.request.contact_email,
    contact_notes: '',
    items: details.request.request_items,
    additional_service_ids: [],
    pickup: {
      city: '',
      city_id: '',
      postal_code: '',
      building: '',
      unit: '',
      district: '',
      address: '',
      notes: '',
      floor: null,
      elevator: null,
      access_notes: '',
    },
    delivery: {
      city: '',
      city_id: '',
      postal_code: '',
      building: '',
      unit: '',
      district: '',
      address: '',
      notes: '',
      floor: null,
      elevator: null,
      access_notes: '',
    },
  };
  for (const location of locations) {
    if (location.kind === 'pickup' || location.kind === 'delivery')
      payload[location.kind] = {
        city: location.city,
        city_id: location.city_id ?? '',
        postal_code: location.postal_code,
        building: location.building,
        unit: location.unit,
        district: location.district,
        address: location.address,
        notes: '',
        floor: location.floor,
        elevator: location.elevator,
        access_notes: location.access_notes,
      };
  }
  const options = details.request.request_additional_services.flatMap((s) =>
    s.additional_services
      ? [
          {
            id: s.additional_services.code,
            name_ar: s.additional_services.name_ar,
            name_en: s.additional_services.name_en,
            active: true,
          },
        ]
      : [],
  );
  payload.additional_service_ids = options.map((o) => o.id);
  return (
    <div className="container page">
      <Link href={`/${locale}/portal/quotes`}>{t.back}</Link>
      <h1>
        {t.pricing} · <bdi>{details.request.reference}</bdi>
      </h1>
      <p>
        {locale === 'ar' ? details.request.markets.name_ar : details.request.markets.name_en} ·{' '}
        <bdi>{details.request.markets.currency}</bdi>
      </p>
      <RequestSummary
        locale={locale}
        payload={payload}
        services={[
          {
            id: '',
            name_ar: details.request.services?.name_ar ?? '',
            name_en: details.request.services?.name_en ?? '',
            property_required: true,
            active: true,
          },
        ]}
        options={options}
        attachments={[]}
      />
      <SalesPricing
        locale={locale}
        requestId={id}
        vehicles={details.vehicles}
        evaluation={latest ?? undefined}
        draft={draft ?? undefined}
      />
    </div>
  );
}

import { createRoot } from 'react-dom/client';
import { RequestWizard } from '@/components/requests/wizard';
import { RequestSummary } from '@/components/requests/summary';
import { QuoteDetailView } from '@/components/pricing/quote-detail-view';
import { OrderProgress } from '@/components/orders/progress';
import { paymentDetails } from '@/domain/payments/model';
import { progressSchema } from '@/domain/operations/model';
import type { RequestDetails } from '@/infrastructure/requests/service';
import type { customerQuoteDetails } from '@/infrastructure/pricing/service';
import { requestId, serviceId, cityId } from './fixture';
import '@/app/globals.css';
import '@/styles/stage1.css';
import '@/styles/customer-experience.css';
import '@/styles/customer-v2.css';
import '@/styles/transport.css';

const query = new URLSearchParams(location.search);
const locale = query.get('locale') === 'ar' ? 'ar' : 'en';
const theme = query.get('theme') || 'light';
document.documentElement.lang = locale;
document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
document.documentElement.dataset.theme = theme;
const initial = (await fetch('/__fixture').then((r) => r.json())) as RequestDetails;
const payload = {
  ...initial.payload,
  service_id: serviceId,
  description: 'TEST boxes',
  pickup: {
    ...initial.payload.pickup,
    city: 'Cairo — TEST',
    city_id: cityId,
    address: 'TEST pickup',
  },
  delivery: {
    ...initial.payload.delivery,
    city: 'Cairo — TEST',
    city_id: cityId,
    address: 'TEST delivery',
  },
};
const quote = {
  id: requestId,
  status: query.get('status') || 'SENT',
  currency: 'EGP',
  quote_items: [
    {
      position: 0,
      label_ar: 'نقل — اختبار',
      label_en: 'Transport — TEST',
      quantity: 1,
      total_amount_minor: 10000,
    },
  ],
  final_subtotal_minor: 10000,
  vat_rate_bps: 0,
  vat_amount_minor: 0,
  total_minor: 10000,
  tax_label_ar: 'اختبار فقط',
  tax_label_en: 'TEST ONLY',
  expires_at: '2099-10-22T00:00:00Z',
  orders: [],
  quotes: {
    request_id: requestId,
    reference: 'TEST-Q',
    requests: {
      reference: 'TEST-R',
      markets: {
        country_code: 'EG',
        name_ar: 'مصر — اختبار',
        name_en: 'Egypt — TEST',
        timezone: 'Africa/Cairo',
      },
      services: { name_ar: 'نقل تجريبي', name_en: 'TEST Transport' },
      request_locations: [
        { kind: 'pickup', city: 'Cairo — TEST' },
        { kind: 'delivery', city: 'TEST destination' },
      ],
    },
  },
} as unknown as Awaited<ReturnType<typeof customerQuoteDetails>>;
const tracking = progressSchema.parse({
  id: requestId,
  reference: 'N365-261022-900001',
  status: 'IN_PROGRESS',
  completedAt: null,
  market: {
    countryCode: 'EG',
    nameAr: 'مصر — اختبار',
    nameEn: 'Egypt — TEST',
    currency: 'EGP',
    timezone: 'Africa/Cairo',
  },
  trips: [
    {
      reference: 'TEST-TRIP',
      status: 'PLANNED',
      totalStops: 2,
      completedStops: 0,
      podCaptured: false,
    },
  ],
});
const payment = paymentDetails.parse({
  orderId: requestId,
  organizationId: requestId,
  reference: 'N365-261022-900001',
  marketId: requestId,
  country: 'EG',
  timezone: 'Africa/Cairo',
  currency: 'EGP',
  subtotalMinor: 10000,
  taxMinor: 0,
  totalMinor: 10000,
  taxLabelAr: 'اختبار فقط',
  taxLabelEn: 'TEST ONLY',
  paymentId: null,
  revision: 0,
  method: 'CASH',
  status: 'CASH_DUE',
  executionAllowed: false,
  canSwitch: false,
  transferAvailable: false,
  destinations: [],
  bank: null,
  attempts: [],
  receipt: null,
});
createRoot(document.getElementById('root')!).render(
  <main className="transport-experience">
    {query.get('view') === 'tracking' ? (
      // Guest presentation excludes live capture/notification effects; real isolation is tested in SQL.
      <OrderProgress locale={locale} data={tracking} payment={payment} guest />
    ) : query.get('view') === 'summary' ? (
      <div className="container page customer-experience">
        <h1>{locale === 'ar' ? 'مراجعة الطلب' : 'Review request'}</h1>
        <RequestSummary
          locale={locale}
          payload={payload}
          services={initial.services}
          options={[]}
          attachments={[]}
        />
      </div>
    ) : query.get('view') === 'quote' ? (
      <QuoteDetailView locale={locale} quote={quote} guest={query.has('guest')} />
    ) : (
      <div className="container page">
        <RequestWizard locale={locale} initial={initial} guest={query.has('guest')} />
      </div>
    )}
  </main>,
);

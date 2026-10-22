import { transportFixture, requestId, serviceId, cityId } from '../transport-ui/fixture';
import { storeOrder, storeOrderPage } from '@/domain/store/model';
import { progressSchema } from '@/domain/operations/model';
import { paymentDetails } from '@/domain/payments/model';
// Explicitly synthetic component-only facts. Never inserted into a database.
export function customerFixture(status = 'SENT', empty = false) {
  const detail = transportFixture();
  detail.request = {
    ...detail.request,
    status: 'SUBMITTED',
    reference: 'N365-261022-900001',
    submitted_at: '2026-10-22T00:00:00Z',
  };
  detail.payload = {
    ...detail.payload,
    service_id: serviceId,
    description: 'TEST packing supplies',
    pickup: {
      ...detail.payload.pickup,
      city: 'Cairo — TEST',
      city_id: cityId,
      address: 'TEST pickup',
    },
    delivery: {
      ...detail.payload.delivery,
      city: 'TEST destination',
      city_id: cityId,
      address: 'TEST delivery',
    },
  };
  const request = {
    id: requestId,
    reference: 'N365-261022-900001',
    status: 'SUBMITTED' as const,
    created_at: '2026-10-22T00:00:00Z',
    preferred_date: null,
    markets: detail.market,
    services: detail.services[0]!,
    request_locations: [
      { kind: 'pickup' as const, city: 'Cairo — TEST' },
      { kind: 'delivery' as const, city: 'TEST destination' },
    ],
  };
  const quote = {
    id: requestId,
    status,
    currency: 'EGP',
    version: 1,
    sent_at: '2026-10-22T00:00:00Z',
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
    quotes: { request_id: requestId, reference: 'TEST-Q', requests: request },
  };
  const progress = progressSchema.parse({
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
  const order = storeOrder.parse({
    id: requestId,
    reference: 'TEST-S',
    revision: 1,
    orderState: 'PLACED',
    fulfillmentState: 'NOT_RELEASED',
    createdAt: '2026-10-22T00:00:00Z',
    address: {
      name: 'TEST Customer',
      phone: 'TEST ONLY',
      region: 'TEST REGION',
      line: 'TEST address',
    },
    subtotalMinor: 10000,
    deliveryMinor: 0,
    taxMinor: 0,
    totalMinor: 10000,
    currency: 'EGP',
    termsAr: 'شروط اختبار فقط',
    termsEn: 'TEST terms only',
    items: [
      {
        content: { title_ar: 'صندوق اختبار', title_en: 'TEST carton' },
        quantity: 1,
        unitPriceMinor: 10000,
      },
    ],
    payment: { method: 'CASH', status: 'PENDING', collector: 'SUPPLIER', destination: null },
    proofs: [],
    events: [{ action: 'PLACED', at: '2026-10-22T00:00:00Z' }],
    moneyOperations: [],
    entries: [],
    permissions: {},
  });
  const storeOrders = storeOrderPage.parse({
    items: empty
      ? []
      : [
          {
            id: requestId,
            reference: 'TEST-S',
            orderState: order.orderState,
            fulfillmentState: order.fulfillmentState,
            paymentStatus: order.payment.status,
            method: 'CASH',
            totalMinor: 10000,
            currency: 'EGP',
            createdAt: order.createdAt,
          },
        ],
    nextCursor: null,
  });
  return {
    detail,
    requests: empty ? [] : [request],
    quote,
    quotes: empty ? [] : [{ reference: 'TEST-Q', requests: request, quote_versions: [quote] }],
    progress,
    payment,
    order,
    storeOrders,
  };
}

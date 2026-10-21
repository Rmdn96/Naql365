import { storeRead } from '@/infrastructure/store/service';
import { storeOrderPage } from '@/domain/store/model';
import { AppError } from '@/domain/shared/errors';
import { storeMoney, storeLabel } from '@/i18n/store';
import { CustomerRecords } from './customer-records';
import type { Locale } from './types';
export async function CustomerStoreRecords({ locale }: { locale: Locale }) {
  let data;
  try {
    data = storeOrderPage.parse(await storeRead('orders'));
  } catch (error) {
    if (error instanceof AppError && error.code === 'forbidden')
      return (
        <p className="cm-note">
          {locale === 'ar'
            ? 'طلبات المتجر غير متاحة لهذا الحساب'
            : 'Store orders are unavailable for this account'}
        </p>
      );
    throw error;
  }
  return (
    <CustomerRecords
      locale={locale}
      records={data.items.slice(0, 4).map((o) => ({
        id: o.id,
        reference: o.reference,
        summary: storeMoney(o.totalMinor, locale),
        status: storeLabel(o.orderState, locale),
        href: '/' + locale + '/store/orders/' + o.id,
      }))}
    />
  );
}

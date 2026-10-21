import Link from 'next/link';
import { ArrowRight, CircleDashed, Package, ShoppingCart, Truck, UserRound } from 'lucide-react';
import { Button } from './button';
import { commerceContent } from './commerce-content';
import { commerceExtra } from './commerce-extra-content';
import type { Locale } from './types';
export function CustomerNavigation({ locale }: { locale: Locale }) {
  const t = commerceContent[locale],
    x = commerceExtra[locale];
  return (
    <nav className="cm-portal-nav" aria-label={x.dashboard}>
      {[
        ['/account/requests', Truck, t.myTransport],
        ['/store/orders', Package, t.myStore],
        ['/store/cart', ShoppingCart, t.cart],
        ['/account', UserRound, t.account],
      ].map(([path, Icon, label]) => {
        const Glyph = Icon as typeof Truck;
        return (
          <Button key={String(path)} variant="quiet" asChild>
            <Link href={'/' + locale + path}>
              <Glyph />
              {String(label)}
            </Link>
          </Button>
        );
      })}
      <Button variant="quiet" asChild>
        <Link href={'/' + locale + '/request'}>
          <Truck />
          {t.book}
        </Link>
      </Button>
    </nav>
  );
}
export function CustomerRecords({
  locale,
  records,
}: {
  locale: Locale;
  records: { id: string; reference: string; summary: string; status: string; href: string }[];
}) {
  const x = commerceExtra[locale];
  return (
    <div className="cm-records">
      {records.length ? (
        records.map((r) => (
          <article key={r.id}>
            <div>
              <strong dir="ltr">{r.reference}</strong>
              <span>{r.summary}</span>
            </div>
            <span className="cm-status">
              <CircleDashed size={13} />
              {r.status}
            </span>
            <Button variant="quiet" asChild>
              <Link href={r.href}>
                {x.open}
                <ArrowRight className="direction-arrow" size={14} />
              </Link>
            </Button>
          </article>
        ))
      ) : (
        <p className="cm-note">{locale === 'ar' ? 'لا توجد طلبات بعد' : 'No orders yet'}</p>
      )}
    </div>
  );
}

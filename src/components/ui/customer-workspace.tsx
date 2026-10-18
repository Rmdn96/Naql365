import Link from 'next/link';
import type { Locale } from '@/i18n/config';

/** Navigation only; destination loaders retain Customer/session authorization. */
export function CustomerWorkspaceNav({
  locale,
  current,
}: {
  locale: Locale;
  current: 'account' | 'requests' | 'quotes';
}) {
  const ar = locale === 'ar';
  return (
    <nav className="customer-workspace-nav" aria-label={ar ? 'مساحة العميل' : 'Customer workspace'}>
      {(
        [
          ['account', ar ? 'نظرة عامة' : 'Overview', '◈'],
          ['requests', ar ? 'طلباتي' : 'My requests', '↗'],
          ['quotes', ar ? 'عروض السعر' : 'Quotes', '▤'],
        ] as const
      ).map(([key, label, symbol]) => (
        <Link
          key={key}
          href={`/${locale}/account${key === 'account' ? '' : '/' + key}`}
          aria-current={current === key ? 'page' : undefined}
        >
          <span aria-hidden="true">{symbol}</span>
          {label}
        </Link>
      ))}
    </nav>
  );
}

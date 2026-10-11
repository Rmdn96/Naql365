import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import { operationsDictionary } from '@/i18n/operations';
import { paymentDictionary } from '@/i18n/payments';
import { quotesDictionary } from '@/i18n/quotes';

export function StaffWorkspaceNav({
  locale,
  active,
}: {
  locale: Locale;
  active: 'home' | 'sales' | 'operations' | 'finance';
}) {
  const ot = operationsDictionary(locale);
  const pt = paymentDictionary(locale);
  const qt = quotesDictionary(locale);
  const links = [
    { id: 'home', href: `/${locale}/portal`, label: locale === 'ar' ? 'نظرة عامة' : 'Overview' },
    { id: 'sales', href: `/${locale}/portal/quotes`, label: qt.salesQuotes },
    { id: 'operations', href: `/${locale}/portal/operations`, label: ot.title },
    { id: 'finance', href: `/${locale}/portal/finance`, label: pt.finance },
  ] as const;
  return (
    <nav
      className="staff-workspace-nav"
      aria-label={locale === 'ar' ? 'مساحات العمل' : 'Workspaces'}
    >
      {links.map((link) => (
        <Link key={link.id} href={link.href} aria-current={active === link.id ? 'page' : undefined}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

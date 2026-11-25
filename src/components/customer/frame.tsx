'use client';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { Locale } from '@/i18n/config';
import { BrandLink } from '@/components/shell/brand-link';
import { DesignFoundation } from '@/components/design-system/foundation';
import { CustomerWorkspaceNav } from '@/components/ui/customer-workspace';
import { isCustomerPath } from './paths';

/** Original CustomerPreview shell, with real links/preferences instead of lab view state. */
export function CustomerFrame({ locale, children }: { locale: Locale; children: ReactNode }) {
  const path = usePathname();
  if (!isCustomerPath(path)) return children;
  const ar = locale === 'ar';
  const section = path.split('/')[3];
  const current = !section ? 'home' : section === 'profile' ? 'account' : 'transport';
  return (
    <DesignFoundation family="customer" className="cx customer-workspace transport-experience">
      <a className="skip-link" href="#customer-content">
        {ar ? 'انتقل إلى المحتوى' : 'Skip to content'}
      </a>
      <div className="cx-shell">
        <aside className="cx-nav">
          <BrandLink
            locale={locale}
            href={`/${locale}/account`}
            label={ar ? 'نقل 365 — حسابي' : 'Naql365 — My account'}
            size="customer"
          />
          <CustomerWorkspaceNav locale={locale} current={current} />
        </aside>
        <div className="cx-main" id="customer-content" tabIndex={-1}>
          {children}
        </div>
      </div>
    </DesignFoundation>
  );
}

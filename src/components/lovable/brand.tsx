import type { Locale } from './types';
import Link from 'next/link';
export function Brand({ locale }: { locale: Locale }) {
  return (
    <Link className="brand" href={'/' + locale} aria-label="Naql365">
      <svg className="brand-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <path
          d="M4 30V10h8l16 20h8V10h-8v13L17 10H4m0 20h8V17"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path d="M22 35h14" stroke="currentColor" strokeWidth="3" />
      </svg>
      <div>
        <div className="brand-word">
          {locale === 'ar' ? 'نقل ' : 'Naql'}
          <em>365</em>
        </div>
        <div className="brand-sub">
          {locale === 'ar' ? 'رحلة نقل أوضح' : 'A clearer transport journey'}
        </div>
      </div>
    </Link>
  );
}

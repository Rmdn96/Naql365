import Link from 'next/link';
import type { Locale } from '@/i18n/config';

type BrandProps = {
  locale: Locale;
  href?: string;
  label?: string;
  className?: string;
  size?: 'public' | 'auth' | 'customer' | 'staff' | 'driver' | 'mobile';
  sourceAppearance?: boolean;
  wordmarkClassName?: string;
};

/** Exact approved Lovable mark. Keep geometry and wordmark shared across layouts. */
export function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path
        d="M4 30V10h8l16 20h8V10h-8v13L17 10H4m0 20h8V17"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path d="M22 35h14" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
}

export function Brand({
  locale,
  href,
  label = 'Naql365',
  className = '',
  size = 'public',
  sourceAppearance = false,
  wordmarkClassName,
}: BrandProps) {
  const attributes = {
    className: `${sourceAppearance ? 'brand' : 'naql-brand'}${className ? ' ' + className : ''}`,
    'aria-label': label,
    'data-naql-brand': size,
  };
  const content = (
    <>
      <BrandMark />
      <div className={wordmarkClassName}>
        <div className="brand-word">
          {locale === 'ar' ? 'نقل ' : 'Naql'}
          <em>365</em>
        </div>
        <div className="brand-sub">
          {locale === 'ar' ? 'رحلة نقل أوضح' : 'A clearer transport journey'}
        </div>
      </div>
    </>
  );
  return href ? (
    <Link {...attributes} href={href}>
      {content}
    </Link>
  ) : (
    <span {...attributes} role="img">
      {content}
    </span>
  );
}

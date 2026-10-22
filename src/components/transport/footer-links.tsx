import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import { legalContent } from '@/domain/legal/content';
import { publicDictionary } from '@/i18n/public';

/** Preserve canonical contact and approved-only legal navigation. */
export function TransportFooterLinks({ locale }: { locale: Locale }) {
  return (
    <>
      <Link href={`/${locale}#contact`}>{publicDictionary(locale).contact}</Link>
      {(['privacy', 'terms'] as const).map((kind) => {
        const copy = legalContent(kind, locale);
        return copy ? (
          <Link key={kind} href={`/${locale}/legal/${kind}`}>
            {copy.title}
          </Link>
        ) : null;
      })}
    </>
  );
}

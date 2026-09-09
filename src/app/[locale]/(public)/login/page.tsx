import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { dictionary } from '@/i18n/dictionaries';
import { Card, Badge } from '@/components/ui/primitives';
export const metadata = { robots: { index: false, follow: false } };
export default async function Login({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; if (!isLocale(locale)) notFound(); const t = dictionary(locale);
  return <div className="container page narrow"><Card><Badge>{t.foundation}</Badge><h1>{t.login}</h1><p>{t.authBody}</p></Card></div>;
}

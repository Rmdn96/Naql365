import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { customerDictionary } from '@/i18n/customer';
import { customerPage } from '@/infrastructure/requests/page-access';
import { StartRequest } from '@/components/requests/wizard';
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await customerPage(locale);
  const t = customerDictionary(locale);
  return (
    <div className="container page narrow">
      <h1>{t.request}</h1>
      <p>{t.savingHint}</p>
      <StartRequest locale={locale} />
    </div>
  );
}

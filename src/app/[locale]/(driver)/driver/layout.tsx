import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { DriverFrame } from '@/components/driver/frame';
import '@/styles/driver-source.css';
import '@/styles/driver-workspace.css';
export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const selected = (await cookies()).get('naql365_theme')?.value;
  const themeMode = selected === 'light' || selected === 'dark' ? selected : 'system';
  return (
    <DriverFrame locale={locale} themeMode={themeMode}>
      {children}
    </DriverFrame>
  );
}

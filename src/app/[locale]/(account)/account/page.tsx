import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { ProtectedShell } from '@/components/shell/protected-shell';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
 const { locale } = await params; if (!isLocale(locale)) notFound();
 return <ProtectedShell locale={locale} portal="account" />;
}

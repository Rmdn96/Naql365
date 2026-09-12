import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { operationsDictionary } from '@/i18n/operations';
import { operationsWorkspace } from '@/infrastructure/operations/service';
import { AppError } from '@/domain/shared/errors';
import { Workspace } from '@/components/operations/workspace';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = operationsDictionary(locale);
  let data;
  try {
    data = await operationsWorkspace();
  } catch (error) {
    if (error instanceof AppError && error.code === 'unauthenticated') redirect(`/${locale}/login`);
    if (error instanceof AppError && error.code === 'forbidden') redirect(`/${locale}/portal`);
    throw error;
  }
  return (
    <div className="container page operations">
      <h1>{t.title}</h1>
      <Workspace locale={locale} data={data} />
    </div>
  );
}

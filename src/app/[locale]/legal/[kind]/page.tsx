import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { legalKind, legalContent } from '@/domain/legal/content';
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; kind: string }>;
}) {
  const { locale, kind } = await params;
  const type = legalKind.safeParse(kind);
  if (!isLocale(locale) || !type.success) notFound();
  const copy = legalContent(type.data, locale);
  if (!copy) notFound();
  return (
    <article className="container page narrow">
      <h1>{copy.title}</h1>
      {copy.paragraphs.map((paragraph, i) => (
        <p key={i}>{paragraph}</p>
      ))}
    </article>
  );
}

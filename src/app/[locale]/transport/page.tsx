import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  FileCheck2,
  Workflow,
  ShieldCheck,
  ArrowRight,
  Package,
  ReceiptText,
  LockKeyhole,
} from 'lucide-react';
import { isLocale } from '@/i18n/config';
import { selectedPublicCountry, publicCatalogue } from '@/infrastructure/markets/public';
import { TransportRouteScene } from '@/components/transport/route-scene';
import copy from '@/components/transport/source-copy.json';
const assuranceIcons = [FileCheck2, Workflow, ShieldCheck];
const clarityIcons = [ReceiptText, FileCheck2, LockKeyhole];
export default async function TransportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [country, catalog] = await Promise.all([selectedPublicCountry(), publicCatalogue()]);
  const market = catalog.find((m) => m.country === country),
    t = copy[locale],
    ar = locale === 'ar';
  return (
    <div className="transport-landing">
      <section className="transport-hero" aria-labelledby="transport-title">
        <div className="transport-hero-layout">
          <div className="transport-hero-copy">
            <p className="transport-eyebrow">{t.eyebrow}</p>
            <h1 id="transport-title">
              {t.headline}
              <span>{t.headlineAccent}</span>
            </h1>
            <p>{t.intro}</p>
            <div className="transport-actions">
              <Link className="button button--primary" href={`/${locale}/request`}>
                {t.request}
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link className="button button--secondary" href={`/${locale}/guest`}>
                {t.track}
              </Link>
            </div>
            <p className="transport-note">
              <ShieldCheck size={14} aria-hidden="true" />
              {t.heroNote}
            </p>
          </div>
          <TransportRouteScene locale={locale} />
        </div>
        <div className="transport-assurances">
          {t.assurances.map(([title, desc], i) => {
            const Icon = assuranceIcons[i]!;
            return (
              <div key={title}>
                <Icon aria-hidden="true" />
                <div>
                  <strong>{title}</strong>
                  <p>{desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <section className="transport-section" aria-labelledby="transport-services">
        <p className="transport-eyebrow">{t.servicesEyebrow}</p>
        <h2 id="transport-services">{t.servicesTitle}</h2>
        <p>{t.servicesIntro}</p>
        <div className="transport-service-grid">
          {market?.services.map((s) => (
            <article key={s.id}>
              <Package aria-hidden="true" />
              <h3>{ar ? s.nameAr : s.nameEn}</h3>
              <Link href={`/${locale}/request`}>{t.request}</Link>
            </article>
          ))}
        </div>
        {!market?.services.length && (
          <p role="status">
            {ar
              ? 'توافر الخدمات يخضع للنطاق المعتمد ومراجعة الطلب.'
              : 'Service availability depends on approved coverage and request review.'}
          </p>
        )}
        {!!market?.cities.length && (
          <p>
            {ar ? 'نقاط الانطلاق المفعّلة: ' : 'Enabled pickup hubs: '}
            {market.cities
              .filter((c) => c.pickupEligible)
              .map((c) => (ar ? c.nameAr : c.nameEn))
              .join('، ')}
          </p>
        )}
      </section>
      <section className="transport-section transport-band">
        <p className="transport-eyebrow">{t.processEyebrow}</p>
        <h2>{t.processTitle}</h2>
        <p>{t.processIntro}</p>
        <ol className="transport-process">
          {t.steps.map(([title, desc], i) => (
            <li key={title}>
              <span>0{i + 1}</span>
              <h3>{title}</h3>
              <p>{desc}</p>
            </li>
          ))}
        </ol>
      </section>
      <section className="transport-section">
        <p className="transport-eyebrow">{t.clarityEyebrow}</p>
        <h2>{t.clarityTitle}</h2>
        <div className="transport-service-grid">
          {t.clarity.map(([title, desc], i) => {
            const Icon = clarityIcons[i]!;
            return (
              <article key={title}>
                <Icon aria-hidden="true" />
                <h3>{title}</h3>
                <p>{desc}</p>
              </article>
            );
          })}
        </div>
      </section>
      <section className="transport-section transport-faq">
        <div>
          <p className="transport-eyebrow">{t.faqEyebrow}</p>
          <h2>{t.faqTitle}</h2>
          <p>{t.faqIntro}</p>
        </div>
        <div>
          {t.faqs.map(([question, answer]) => (
            <details key={question}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="transport-section transport-final">
        <div>
          <h2>{t.finalTitle}</h2>
          <p>{t.finalIntro}</p>
        </div>
        <Link className="button button--primary" href={`/${locale}/request`}>
          {t.request}
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}

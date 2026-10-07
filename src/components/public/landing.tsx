import Link from 'next/link';
import { Select, Button } from '@/components/ui/primitives';
import { MvpView } from './analytics';
import type { Locale } from '@/i18n/config';
import { publicDictionary } from '@/i18n/public';
import { whatsappUrl, type PublicCountry } from '@/domain/markets/public-contact';
import { RouteMotif } from '@/components/ui/route-motif';

export function Landing({
  locale,
  country,
  services,
  cities,
}: {
  locale: Locale;
  country: PublicCountry;
  services: { id: string; nameAr: string; nameEn: string }[];
  cities: {
    id: string;
    nameAr: string;
    nameEn: string;
    pickupEligible: boolean;
    deliveryEligible: boolean;
  }[];
}) {
  const t = publicDictionary(locale),
    request = `/${locale}/request`,
    wa = whatsappUrl(country, locale);
  const coverage =
    locale === 'ar'
      ? country === 'SA'
        ? 'نقل داخل الرياض، ومن الرياض إلى الوجهات المفعّلة فقط.'
        : 'نقل داخل القاهرة، ومن القاهرة إلى الوجهات المفعّلة فقط.'
      : country === 'SA'
        ? 'Within Riyadh and from Riyadh to activated destinations only.'
        : 'Within Cairo and from Cairo to activated destinations only.';
  const stages =
    locale === 'ar'
      ? ['الطلب', 'مراجعة المبيعات', 'عرض السعر النهائي', 'النقل', 'التسليم']
      : ['Request', 'Sales review', 'Final quote', 'Transport', 'Delivery'];
  return (
    <div className="launch-page">
      <MvpView event="homepage_viewed" market={country} context="home" />
      <section className="launch-hero">
        <div className="container launch-hero-grid">
          <div className="launch-hero-copy">
            <p className="eyebrow">{country === 'SA' ? t.sa : t.eg} · Naql365</p>
            <h1>{t.headline}</h1>
            <p className="launch-lead">{t.intro}</p>
            <p className="coverage-note">{coverage}</p>
            <div className="actions">
              <Link href={request} className="button button--primary">
                {t.start}
                <span aria-hidden="true"> ↗</span>
              </Link>
              <a href={wa} className="button launch-secondary" rel="noreferrer">
                {t.whatsapp}
              </a>
            </div>
            <p className="launch-assurance">{t.noAccount}</p>
          </div>
          <figure className="route-illustration">
            <div className="route-grid" aria-hidden="true" />
            <div className="route-visual-line" aria-hidden="true" />
            <div className="route-visual-card route-visual-card--first">
              <span className="route-dot" aria-hidden="true" />
              <strong>{t.received}</strong>
              <span>{t.pickup}</span>
            </div>
            <div className="route-visual-card route-visual-card--middle">
              <span className="route-dot route-dot--blue" aria-hidden="true" />
              <strong>{t.review}</strong>
              <span>Naql365</span>
            </div>
            <div className="route-visual-card route-visual-card--last">
              <span className="route-dot route-dot--cyan" aria-hidden="true" />
              <strong>{t.delivered}</strong>
              <span>{t.delivery}</span>
            </div>
            <figcaption>{t.illustration}</figcaption>
          </figure>
        </div>
      </section>
      <section className="container launch-quick" aria-labelledby="quick-title">
        <div>
          <p className="eyebrow">{country === 'SA' ? t.sa : t.eg}</p>
          <h2 id="quick-title">{t.quickTitle}</h2>
          <p>{t.quickBody}</p>
        </div>
        {services.length && cities.length ? (
          <form action={request} method="get" className="stack">
            <input type="hidden" name="country" value={country} />
            <Select id="quick-service" name="service" label={t.services} required defaultValue="">
              <option value="">{t.services}</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {locale === 'ar' ? s.nameAr : s.nameEn}
                </option>
              ))}
            </Select>
            {(['pickupCity', 'deliveryCity'] as const).map((name, i) => (
              <Select
                key={name}
                id={`quick-${name}`}
                name={name}
                label={i === 0 ? t.pickup : t.delivery}
                required
                defaultValue=""
              >
                <option value="">{i === 0 ? t.pickup : t.delivery}</option>
                {cities
                  .filter((c) => (i === 0 ? c.pickupEligible : c.deliveryEligible))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {locale === 'ar' ? c.nameAr : c.nameEn}
                    </option>
                  ))}
              </Select>
            ))}
            <Button>{t.quickAction}</Button>
          </form>
        ) : (
          <Link href={request} className="button button--primary">
            {t.quickAction}
          </Link>
        )}
      </section>
      <section id="how" className="launch-how">
        <div className="container launch-section">
          <p className="eyebrow">{t.how}</p>
          <h2>{t.howTitle}</h2>
          <RouteMotif labels={stages} />
          <div className="launch-steps">
            {t.steps.map(([title, body]) => (
              <p key={title}>{body}</p>
            ))}
          </div>
        </div>
      </section>
      <section id="services" className="container launch-section">
        <p className="eyebrow">{t.services}</p>
        <h2>{t.servicesTitle}</h2>
        <p className="section-intro">{t.servicesBody}</p>
        <div className="launch-services">
          {services.map((service, index) => (
            <article key={service.id}>
              <span className="service-index" aria-hidden="true">
                0{index + 1}
              </span>
              <h3>{locale === 'ar' ? service.nameAr : service.nameEn}</h3>
              <Link href={request}>
                {t.request}
                <span aria-hidden="true"> ↗</span>
              </Link>
            </article>
          ))}
        </div>
        {!services.length && (
          <p>
            {t.noServices}{' '}
            <a href={wa} rel="noreferrer">
              {t.whatsapp}
            </a>
          </p>
        )}
      </section>
      <section id="coverage" className="container launch-section">
        <p className="eyebrow">{country === 'SA' ? t.sa : t.eg}</p>
        <h2>{locale === 'ar' ? 'نطاق الخدمة المتاح' : 'Available coverage'}</h2>
        <p>{coverage}</p>
        <ul className="coverage-cities">
          {cities
            .filter((c) => c.deliveryEligible)
            .map((c) => (
              <li key={c.id}>{locale === 'ar' ? c.nameAr : c.nameEn}</li>
            ))}
        </ul>
        <p>
          {locale === 'ar'
            ? 'تتحدد الخيارات المتاحة حسب الخدمة المختارة. السعر قيد مراجعة فريق المبيعات.'
            : 'Available options depend on your selected service. Pricing is reviewed by our Sales team.'}
        </p>
      </section>
      <section id="tracking" className="container launch-section launch-split">
        <div>
          <p className="eyebrow">{t.track}</p>
          <h2>{t.trackingTitle}</h2>
          <p>{t.trackingBody}</p>
          <p className="launch-track-help">{t.trackingHelp}</p>
          <Link href={`/${locale}/guest`} className="button button--secondary">
            {t.track}
          </Link>
        </div>
        <div className="tracking-demo">
          <p className="eyebrow">{t.illustration}</p>
          <RouteMotif labels={[t.received, t.assigned, t.onWay, t.delivered]} />
        </div>
      </section>
      <section className="container launch-business">
        <div>
          <h2>{t.businessTitle}</h2>
          <p>{t.businessBody}</p>
        </div>
        <a href={wa} className="button button--primary" rel="noreferrer">
          {t.whatsapp}
        </a>
      </section>
      <section className="container launch-section">
        <h2>{t.whyTitle}</h2>
        <ul className="launch-benefits">
          {t.why.map((item) => (
            <li key={item}>
              <span aria-hidden="true">✓</span>
              {item}
            </li>
          ))}
        </ul>
      </section>
      <section className="container launch-section launch-faq">
        <h2>{t.faq}</h2>
        <div>
          {t.questions.map(([question, answer]) => (
            <details key={question}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
      <section id="contact" className="launch-final">
        <div className="container">
          <p className="eyebrow">Naql365 · نقل 365</p>
          <h2>{t.finalTitle}</h2>
          <p>{t.finalBody}</p>
          <div className="actions">
            <Link href={request} className="button button--primary">
              {t.start}
            </Link>
            <a href={wa} className="button launch-secondary" rel="noreferrer">
              {t.whatsapp}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

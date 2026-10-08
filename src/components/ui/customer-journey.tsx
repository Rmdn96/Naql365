import type { Locale } from '@/i18n/config';
import { customerExperience } from '@/i18n/customer-experience';

/** Presentation of already-authorized route facts, never an access credential. */
export function JourneyRoute({
  pickup,
  delivery,
  locale,
}: {
  pickup: string;
  delivery: string;
  locale: Locale;
}) {
  return (
    <dl className="journey-route">
      <div>
        <dt>{locale === 'ar' ? 'الاستلام' : 'Pickup'}</dt>
        <dd>{pickup || '—'}</dd>
      </div>
      <div>
        <dt>{locale === 'ar' ? 'التسليم' : 'Delivery'}</dt>
        <dd>{delivery || '—'}</dd>
      </div>
    </dl>
  );
}

export function ReviewNotice({ locale }: { locale: Locale }) {
  const t = customerExperience(locale);
  return (
    <section className="journey-notice">
      <span className="route-dot" aria-hidden="true" />
      <div>
        <h2>{t.reviewTitle}</h2>
        <p>{t.reviewHelp}</p>
      </div>
    </section>
  );
}

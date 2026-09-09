import type { Locale } from '@/i18n/config';
import { customerDictionary } from '@/i18n/customer';
import type { RequestDetails } from '@/infrastructure/requests/service';
import type { RequestDraft } from '@/domain/requests/intake';
export function RequestSummary({
  locale,
  payload,
  services,
  options,
  attachments,
}: {
  locale: Locale;
  payload: RequestDraft;
  services: RequestDetails['services'];
  options: RequestDetails['options'];
  attachments: RequestDetails['attachments'];
}) {
  const t = customerDictionary(locale);
  const service = services.find((s) => s.id === payload.service_id);
  const value = (s: string | null | undefined) => s || t.noValue;
  return (
    <div className="request-summary">
      <section>
        <h2>{t.service}</h2>
        <p>{value(locale === 'ar' ? service?.name_ar : service?.name_en)}</p>
      </section>
      {(['pickup', 'delivery'] as const).map((kind) => (
        <section key={kind}>
          <h2>{t[kind]}</h2>
          <dl>
            <dt>{t.city}</dt>
            <dd>{value(payload[kind].city)}</dd>
            <dt>{t.district}</dt>
            <dd>{value(payload[kind].district)}</dd>
            <dt>{t.address}</dt>
            <dd>{value(payload[kind].address)}</dd>
            <dt>{t.notes}</dt>
            <dd>{value(payload[kind].notes)}</dd>
            {service?.property_required && (
              <>
                <dt>{t.floor}</dt>
                <dd>{payload[kind].floor ?? t.noValue}</dd>
                <dt>{t.elevator}</dt>
                <dd>
                  {payload[kind].elevator === null
                    ? t.unspecified
                    : payload[kind].elevator
                      ? t.yes
                      : t.no}
                </dd>
                <dt>{t.accessNotes}</dt>
                <dd>{value(payload[kind].access_notes)}</dd>
              </>
            )}
          </dl>
        </section>
      ))}
      <section>
        <h2>{t.shipment}</h2>
        <p>{value(payload.description)}</p>
        <p>{value(payload.notes)}</p>
        <ul>
          {payload.items.map((item, i) => (
            <li key={i}>
              {item.description} × {item.quantity}
              {item.notes && ` — ${item.notes}`}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>{t.extras}</h2>
        <ul>
          {options
            .filter((o) => payload.additional_service_ids.includes(o.id))
            .map((o) => (
              <li key={o.id}>{locale === 'ar' ? o.name_ar : o.name_en}</li>
            ))}
        </ul>
        {!payload.additional_service_ids.length && <p>{t.noValue}</p>}
      </section>
      <section>
        <h2>{t.schedule}</h2>
        <p>
          <bdi>{value(payload.preferred_date)}</bdi> ·{' '}
          {payload.time_window ? t[payload.time_window] : t.noValue}
        </p>
        <small>{t.scheduleHint}</small>
      </section>
      <section>
        <h2>{t.contact}</h2>
        <p>{value(payload.contact_name)}</p>
        <p>
          <bdi>{value(payload.contact_phone)}</bdi>
        </p>
        <p>
          <bdi>{value(payload.contact_email)}</bdi>
        </p>
        <p>{value(payload.contact_notes)}</p>
      </section>
      <section>
        <h2>{t.attachments}</h2>
        <ul>
          {attachments.map((file, index) => (
            <li key={file.id}>
              {file.upload_state === 'ready' ? (
                <a
                  href={`/api/customer/files/${file.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t.viewFile} {index + 1}
                </a>
              ) : (
                t.pendingFile
              )}
            </li>
          ))}
        </ul>
        {!attachments.length && <p>{t.noFiles}</p>}
      </section>
    </div>
  );
}

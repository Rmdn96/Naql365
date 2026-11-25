import { MessageCircle, Phone } from 'lucide-react';
import { marketContact, whatsappUrl } from '@/domain/markets/public-contact';
import type { Locale } from '@/i18n/config';

export function ContactLinks({ locale, footer = false }: { locale: Locale; footer?: boolean }) {
  const contact = marketContact.EG;
  const ar = locale === 'ar';
  return (
    <>
      <a href={'tel:+' + contact.destination}>
        <Phone size={16} aria-hidden="true" />
        <bdi>{contact.display}</bdi>
      </a>
      <a
        className="launch-whatsapp"
        href={whatsappUrl('EG', locale)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={footer ? (ar ? 'واتساب نقل 365' : 'Naql365 WhatsApp') : undefined}
      >
        <MessageCircle size={16} aria-hidden="true" />
        {ar ? 'واتساب' : 'WhatsApp'}
      </a>
    </>
  );
}

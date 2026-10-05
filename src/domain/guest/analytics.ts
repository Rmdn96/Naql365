import { z } from 'zod';
import { publicCountry } from '@/domain/markets/public-contact';

// Finite event/context vocabulary: no arbitrary properties, identities, URLs or GPS.
export const mvpAnalyticsEvent = z
  .object({
    event: z.enum([
      'homepage_viewed',
      'request_started',
      'request_completed',
      'preliminary_quote_viewed',
      'final_quote_viewed',
      'quote_accepted',
      'quote_rejected',
      'payment_method_selected',
      'transfer_proof_submitted',
      'tracking_viewed',
      'whatsapp_clicked',
    ]),
    market: publicCountry,
    context: z.enum(['home', 'request', 'quote', 'checkout', 'tracking']),
  })
  .strict();

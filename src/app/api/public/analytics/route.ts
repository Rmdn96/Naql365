import { apiResult, checkOrigin, readJson } from '@/infrastructure/requests/http';
import { mvpAnalyticsEvent } from '@/domain/guest/analytics';
import { guestDatabase, guestDatabaseError } from '@/infrastructure/guest/session';
import { getPublicEnv } from '@/infrastructure/config/public-env';

export async function POST(request: Request) {
  return apiResult(async () => {
    checkOrigin(request);
    const event = mvpAnalyticsEvent.parse(await readJson(request));
    if (getPublicEnv()) {
      const { error } = await guestDatabase().rpc('record_mvp_event', {
        p_event: event.event,
        p_country: event.market,
        p_context: event.context,
      });
      if (error) guestDatabaseError(error.code);
    }
    return { received: true };
  });
}

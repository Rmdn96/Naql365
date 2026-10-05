import 'server-only';
import { launchPresentation } from '@/domain/guest/launch';
export function launchFlags() {
  // Presentation only. Existing tracking RPC/RLS authorization is always required.
  // Guest live location is excluded regardless of this flag.
  return launchPresentation(process.env.LAUNCH_CUSTOMER_LIVE_TRACKING);
}

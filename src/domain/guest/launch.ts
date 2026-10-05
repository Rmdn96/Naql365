import { z } from 'zod';
export function launchPresentation(value: unknown) {
  return {
    customerLiveTracking:
      z
        .enum(['true', 'false'])
        .default('false')
        .parse(value || undefined) === 'true',
  };
}

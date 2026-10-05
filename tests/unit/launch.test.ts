import { expect, test } from 'vitest';
import { launchPresentation } from '@/domain/guest/launch';
import { legalContent } from '@/domain/legal/content';
test('live tracking presentation is opt-in and invalid flags fail closed', () => {
  expect(launchPresentation(undefined).customerLiveTracking).toBe(false);
  expect(launchPresentation('false').customerLiveTracking).toBe(false);
  expect(launchPresentation('true').customerLiveTracking).toBe(true);
  expect(() => launchPresentation('typo')).toThrow();
});
test('unapproved legal copy cannot appear as public placeholder text', () => {
  for (const locale of ['ar', 'en'] as const)
    for (const kind of ['privacy', 'terms'] as const) expect(legalContent(kind, locale)).toBeNull();
});

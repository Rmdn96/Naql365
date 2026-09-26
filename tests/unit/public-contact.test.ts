import { expect, test } from 'vitest';
import { whatsappUrl } from '@/domain/markets/public-contact';
import { mvpAnalyticsEvent } from '@/domain/guest/analytics';
import { createGuestSecret } from '@/infrastructure/guest/secret';

test('public contact follows country independently of language', () => {
  for (const locale of ['ar', 'en'] as const) {
    expect(new URL(whatsappUrl('SA', locale)).pathname).toBe('/966558985250');
    expect(new URL(whatsappUrl('EG', locale)).pathname).toBe('/201009402374');
    expect(
      new URL(whatsappUrl('EG', locale, 'N365-202609-000125')).searchParams.get('text'),
    ).toContain('N365-202609-000125');
  }
});

test('WhatsApp refuses arbitrary payloads and capability tokens', () => {
  for (const value of [
    createGuestSecret(),
    'https://example.invalid/proof',
    'N365-202609-000125&token=private',
    'recipient@example.invalid',
  ])
    expect(() => whatsappUrl('SA', 'ar', value)).toThrow();
});

test('analytics allow only finite non-sensitive fields', () => {
  const event = { event: 'whatsapp_clicked', market: 'EG', context: 'checkout' };
  expect(mvpAnalyticsEvent.safeParse(event).success).toBe(true);
  for (const field of [
    'token',
    'phone',
    'url',
    'latitude',
    'account_number',
    'proof_url',
    'reference',
  ])
    expect(mvpAnalyticsEvent.safeParse({ ...event, [field]: 'private' }).success).toBe(false);
  expect(mvpAnalyticsEvent.safeParse({ ...event, context: '/ar/guest#private' }).success).toBe(
    false,
  );
});

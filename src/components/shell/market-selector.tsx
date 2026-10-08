'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PublicCountry } from '@/domain/markets/public-contact';
import type { Locale } from '@/i18n/config';
import { publicDictionary } from '@/i18n/public';
export function MarketSelector({
  country,
  locale,
  id = 'public-market',
}: {
  country: PublicCountry;
  locale: Locale;
  id?: string;
}) {
  const router = useRouter(),
    t = publicDictionary(locale);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  async function change(value: string) {
    setBusy(true);
    setError(false);
    try {
      const response = await fetch('/api/public/market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country: value }),
      });
      if (!response.ok) throw new Error();
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="market-control">
      <label className="sr-only" htmlFor={id}>
        {t.country}
      </label>
      <select id={id} value={country} disabled={busy} onChange={(e) => void change(e.target.value)}>
        <option value="SA">🇸🇦 {t.sa}</option>
        <option value="EG">🇪🇬 {t.eg}</option>
      </select>
      {error && <span role="alert">{t.updateError}</span>}
    </div>
  );
}

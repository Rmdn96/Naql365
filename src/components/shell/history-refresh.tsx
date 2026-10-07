'use client';
import { useEffect } from 'react';
// A restored browser history snapshot must revalidate its server-rendered authority.
export function HistoryRefresh() {
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener('pageshow', restore);
    return () => window.removeEventListener('pageshow', restore);
  }, []);
  return null;
}

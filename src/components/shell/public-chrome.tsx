'use client';
import { usePathname } from 'next/navigation';
export function PublicChrome({ children }: { children: React.ReactNode }) {
  return /^\/(ar|en)\/portal(?:\/|$)/.test(usePathname()) ? null : children;
}

'use client';
import { usePathname } from 'next/navigation';
import { isTransportPath } from '@/components/transport/paths';
import { isCustomerPath } from '@/components/customer/paths';
export function isAuthPath(pathname: string) {
  return /^\/(ar|en)\/(login|register|recover|password|auth-complete|driver\/login)\/?$/.test(
    pathname,
  );
}
export function AuthChrome({ children }: { children: React.ReactNode }) {
  return isAuthPath(usePathname()) ? children : null;
}
export function PublicChrome({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return isAuthPath(path) ||
    isCustomerPath(path) ||
    isTransportPath(path) ||
    /^\/(ar|en)(?:$|\/(?:portal|store|account$)(?:\/|$))/.test(path)
    ? null
    : children;
}

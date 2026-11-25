'use client';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { isTransportPath } from './paths';
import { isCustomerPath } from '@/components/customer/paths';

export function TransportFrame({ children }: { children?: ReactNode }) {
  const path = usePathname();
  if (!isTransportPath(path) || isCustomerPath(path)) return children;
  return (
    <div className="transport-experience" data-design-family="public">
      <div className="transport-content">{children}</div>
    </div>
  );
}

import type { ReactNode } from 'react';
import { AlertTriangle, Loader2, Lock } from 'lucide-react';
export function DriverState({
  state,
  title,
  children,
}: {
  state: 'loading' | 'error' | 'unavailable';
  title: string;
  children?: ReactNode;
}) {
  const Icon = state === 'loading' ? Loader2 : state === 'error' ? AlertTriangle : Lock;
  return (
    <section
      className="dx-state driver-state"
      role={state === 'loading' ? 'status' : 'alert'}
      aria-busy={state === 'loading'}
    >
      <Icon size={24} aria-hidden="true" />
      <h1>{title}</h1>
      {children}
    </section>
  );
}

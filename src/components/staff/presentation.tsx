import type { ReactNode } from 'react';
import { AlertTriangle, CircleDashed, FileText, Info } from 'lucide-react';
import { PageHeader } from '@/components/ui/presentation';

/** Original Lovable Staff presentation only; no preview state or permission authority. */
export function StaffPageHeader(props: Parameters<typeof PageHeader>[0]) {
  return (
    <div className="sx-page-head">
      <PageHeader {...props} />
    </div>
  );
}
export function StaffNote({ children }: { children: ReactNode }) {
  return (
    <p className="sx-note">
      <Info size={16} aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
export function StaffState({
  state,
  title,
  children,
}: {
  state: 'loading' | 'empty' | 'error' | 'unavailable';
  title: string;
  children?: ReactNode;
}) {
  const Icon = state === 'error' ? AlertTriangle : state === 'loading' ? CircleDashed : FileText;
  return (
    <section
      className="sx-state"
      role={
        state === 'error' || state === 'unavailable'
          ? 'alert'
          : state === 'loading'
            ? 'status'
            : undefined
      }
      aria-busy={state === 'loading' ? true : undefined}
    >
      <Icon size={28} aria-hidden="true" />
      <h1>{title}</h1>
      {children}
      {state === 'loading' && <div className="sx-skeleton" aria-hidden="true" />}
    </section>
  );
}

/** Original Staff queue table structure; cells remain caller-projected authorized data. */
export function StaffTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: readonly string[];
  rows: readonly (readonly ReactNode[])[];
}) {
  return (
    <div className="sx-table-wrap" role="region" aria-label={caption} tabIndex={0}>
      <table className="sx-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th key={index} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

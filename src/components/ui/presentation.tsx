import type { ReactNode } from 'react';

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </header>
  );
}
export function SectionHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      {children}
    </div>
  );
}
export function Toolbar({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="workspace-toolbar" role="group" aria-label={label}>
      {children}
    </div>
  );
}
export function StatusBadge({
  children,
  tone = 'info',
}: {
  children: ReactNode;
  tone?: 'info' | 'success' | 'warning' | 'error' | 'neutral';
}) {
  const symbol = { info: '●', success: '✓', warning: '!', error: '!', neutral: '—' }[tone];
  return (
    <span className={`status-badge status-badge--${tone}`}>
      <span aria-hidden="true">{symbol}</span>
      {children}
    </span>
  );
}
export function SummaryCard({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="summary-card">
      <h2>{title}</h2>
      <div>{children}</div>
      {actions && <div className="actions">{actions}</div>}
    </section>
  );
}
export function Skeleton({ label }: { label: string }) {
  return (
    <div className="skeleton" role="status">
      <span>{label}</span>
      <div aria-hidden="true" className="skeleton-line" />
      <div aria-hidden="true" className="skeleton-line" />
    </div>
  );
}

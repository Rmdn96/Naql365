import { CircleDashed } from 'lucide-react';
export function StoreSlot({ label, currency = false }: { label: string; currency?: boolean }) {
  return (
    <div className="st-slot">
      <dt>{label}</dt>
      <dd>
        <span dir="ltr">—{currency ? ' EGP' : ''}</span>
        <small>
          <CircleDashed size={12} aria-hidden="true" />
          <span lang="ar">بانتظار الاعتماد</span> / <span lang="en">Pending approval</span>
        </small>
      </dd>
    </div>
  );
}

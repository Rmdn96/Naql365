import Link from 'next/link';

export function BrandLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="brand" aria-label={label}>
      <span className="brand-symbol" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span dir="ltr">
        Naql<span>365</span>
      </span>
    </Link>
  );
}

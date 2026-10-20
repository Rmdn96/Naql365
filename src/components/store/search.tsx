export function StoreSearch({ locale }: { locale: 'ar' | 'en' }) {
  const text = locale === 'ar' ? 'ابحث عن مستلزمات التغليف' : 'Search packing supplies';
  return (
    <form action={`/${locale}/store`} method="get" role="search" className="commerce-search">
      <label className="sr-only" htmlFor="commerce-search">
        {text}
      </label>
      <input id="commerce-search" name="search" type="search" placeholder={text} maxLength={120} />
      <button className="button button--primary" aria-label={locale === 'ar' ? 'بحث' : 'Search'}>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <circle cx="10" cy="10" r="7" />
          <path d="m15 15 6 6" />
        </svg>
      </button>
    </form>
  );
}

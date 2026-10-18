/** Illustrative visual story only. No shipment status, GPS or operational data. */
export function RouteStory({ labels, caption }: { labels: string[]; caption: string }) {
  return (
    <figure className="v2-route-story">
      <svg viewBox="0 0 500 500" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <pattern id="v2-route-grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#35495d" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="500" height="500" fill="url(#v2-route-grid)" />
        <path
          d="M375 60 C375 120 125 80 125 145 S375 180 375 225 S125 265 125 305 S375 350 375 390"
          fill="none"
          stroke="#427dff"
          strokeWidth="3"
          strokeDasharray="6 8"
        />
      </svg>
      <ol>
        {labels.map((label, i) => (
          <li key={label}>
            <span aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
            <strong>{label}</strong>
          </li>
        ))}
      </ol>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

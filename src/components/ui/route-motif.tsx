export function RouteMotif({ labels, journey = false }: { labels: string[]; journey?: boolean }) {
  return (
    <ol className={`route-motif${journey ? ' route-motif--journey' : ''}`}>
      {labels.map((label, index) => (
        <li key={`${index}-${label}`}>
          <span className="route-node" aria-hidden="true">
            {index + 1}
          </span>
          <span>{label}</span>
        </li>
      ))}
    </ol>
  );
}

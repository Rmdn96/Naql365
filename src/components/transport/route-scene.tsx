import { Package, Route, Truck, Navigation, MapPin, Info } from 'lucide-react';
import { SourceImage } from '@/components/lovable/source-image';
import type { Locale } from '@/i18n/config';
import copy from './source-copy.json';
const icons = [Package, Route, Truck, Navigation, MapPin];
/** Original RouteScene. Illustration only; never a substitute for live tracking. */
export function TransportRouteScene({ locale }: { locale: Locale }) {
  const t = copy[locale];
  return (
    <figure className="transport-route-scene" aria-label={t.routeNote}>
      <SourceImage
        className="transport-route-image"
        src="/lovable/transport-route-map.jpg"
        width={1536}
        height={1024}
        alt=""
        sizes="(max-width: 900px) 100vw, 50vw"
      />
      <div className="transport-route-top">
        <span>{t.routeTitle}</span>
        <span>
          <Info size={12} aria-hidden="true" />
          {t.illustrative}
        </span>
      </div>
      <svg
        className="transport-route-lines"
        viewBox="0 0 520 385"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M425 98 C425 125 220 100 220 158 S375 175 375 235 S155 232 155 290 S322 292 322 345" />
      </svg>
      {t.nodes.map((node, i) => {
        const Icon = icons[i]!;
        return (
          <div className={`transport-route-node node-${i}`} key={node}>
            <Icon aria-hidden="true" />
            <div>
              {node}
              <small>{t.nodeNotes[i]}</small>
            </div>
          </div>
        );
      })}
      <figcaption>{t.routeNote}</figcaption>
    </figure>
  );
}

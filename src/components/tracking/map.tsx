'use client';
import Image from 'next/image';
import { useState } from 'react';
import type { Locale } from '@/i18n/config';
import type { MapPoint } from '@/domain/tracking/model';
import { trackingDictionary } from '@/i18n/tracking';
function pixel(p: MapPoint, z: number) {
  const n = 2 ** z * 256,
    lat = (Math.max(-85.0511, Math.min(85.0511, p.latitude)) * Math.PI) / 180;
  return {
    x: ((p.longitude + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2) * n,
  };
}
export function OpenStreetMap({ points, locale }: { points: readonly MapPoint[]; locale: Locale }) {
  const [visible, setVisible] = useState(false),
    t = trackingDictionary(locale);
  if (!points.length) return null;
  let zoom = 14;
  while (zoom > 1) {
    const p = points.map((v) => pixel(v, zoom));
    if (
      Math.max(...p.map((v) => v.x)) - Math.min(...p.map((v) => v.x)) < 260 &&
      Math.max(...p.map((v) => v.y)) - Math.min(...p.map((v) => v.y)) < 260
    )
      break;
    zoom--;
  }
  const projected = points.map((p) => ({ ...pixel(p, zoom), point: p })),
    cx = (Math.min(...projected.map((p) => p.x)) + Math.max(...projected.map((p) => p.x))) / 2,
    cy = (Math.min(...projected.map((p) => p.y)) + Math.max(...projected.map((p) => p.y))) / 2;
  const centerX = Math.floor(cx / 256),
    centerY = Math.floor(cy / 256),
    tiles = [-1, 0, 1]
      .flatMap((x) => [-1, 0, 1].map((y) => ({ x: centerX + x, y: centerY + y })))
      .filter((p) => p.y >= 0 && p.y < 2 ** zoom);
  return (
    <section>
      <p>{t.mapPrivacy}</p>
      <button type="button" aria-expanded={visible} onClick={() => setVisible(!visible)}>
        {visible ? t.hideMap : t.map}
      </button>
      {visible && (
        <>
          <div className="tracking-map" role="img" aria-label={t.title} dir="ltr">
            <div className="tracking-map-surface">
              {tiles.map((p) => (
                <Image
                  key={`${zoom}-${p.x}-${p.y}`}
                  unoptimized
                  src={`https://tile.openstreetmap.org/${zoom}/${((p.x % 2 ** zoom) + 2 ** zoom) % 2 ** zoom}/${p.y}.png`}
                  alt=""
                  width={256}
                  height={256}
                  referrerPolicy="strict-origin-when-cross-origin"
                  style={{
                    position: 'absolute',
                    left: p.x * 256 - cx + 256,
                    top: p.y * 256 - cy + 256,
                    maxWidth: 'none',
                  }}
                />
              ))}
              {projected.map((p) => (
                <span
                  key={p.point.id}
                  title={p.point.label}
                  className="tracking-marker"
                  style={{ left: p.x - cx + 256, top: p.y - cy + 256 }}
                >
                  ●
                </span>
              ))}
            </div>
          </div>
          <p>
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
              © OpenStreetMap contributors
            </a>
          </p>
        </>
      )}
    </section>
  );
}

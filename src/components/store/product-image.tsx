'use client';
import Image from 'next/image';
export function StoreProductImage({
  src,
  alt,
  width = 480,
  height = 360,
}: {
  src: string;
  alt: string;
  width?: number;
  height?: number;
}) {
  const uploaded = src.startsWith('/api/store/media/');
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes="(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 480px"
      {...(uploaded
        ? {
            loader: ({ src, width }: { src: string; width: number }) =>
              src + '?width=' + Math.max(64, Math.min(1600, width)),
          }
        : {})}
    />
  );
}

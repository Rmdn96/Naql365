'use client';
import Image from 'next/image';
import type { ComponentProps } from 'react';
export function SourceImage({
  src,
  alt,
  sizes = '(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 480px',
  ...props
}: Omit<ComponentProps<typeof Image>, 'src'> & { src?: string | undefined }) {
  if (!src) return null;
  return (
    <Image
      {...props}
      src={src}
      alt={alt}
      sizes={sizes}
      {...(src.startsWith('/api/store/media/')
        ? {
            loader: ({ src, width }: { src: string; width: number }) =>
              src + '?width=' + Math.max(64, Math.min(1600, width)),
          }
        : {})}
    />
  );
}

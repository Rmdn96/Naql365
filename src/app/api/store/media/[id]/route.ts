import { productImage } from '@/infrastructure/store/media';
import { z } from 'zod';
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const width = z.coerce
      .number()
      .int()
      .min(64)
      .max(1600)
      .parse(new URL(_request.url).searchParams.get('width') ?? 1600);
    const bytes = await productImage((await context.params).id, width);
    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': 'image/webp',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new Response('Image unavailable', {
      status: 404,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }
}

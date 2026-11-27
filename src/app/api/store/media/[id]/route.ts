import { productImage } from '@/infrastructure/store/media';
import { z } from 'zod';
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const query = new URL(_request.url).searchParams;
    const kind = z.enum(['product', 'category']).parse(query.get('kind') ?? 'product');
    const width = z.coerce
      .number()
      .int()
      .min(64)
      .max(1600)
      .parse(query.get('width') ?? 1600);
    const bytes = await productImage((await context.params).id, width, kind);
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

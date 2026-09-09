import 'server-only';
import { z } from 'zod';
export function appUrl(): URL {
  const input = process.env.APP_URL;
  if (!input && process.env.NODE_ENV !== 'production') return new URL('http://localhost:3000');
  const parsed = z.url().safeParse(input);
  if (!parsed.success) throw new Error('APP_URL must be a valid canonical origin');
  const url = new URL(parsed.data);
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
      (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)))
    throw new Error('APP_URL must be an HTTPS origin (HTTP loopback allowed for local tests)');
  return url;
}

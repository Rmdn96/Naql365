import { z } from 'zod';
const schema = z.object({
  url: z.url().refine(value => value.startsWith('https://') || /^http:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(value)),
  publishableKey: z.string().min(1),
});
export function getPublicEnv() {
  const result = schema.safeParse({ url: process.env.NEXT_PUBLIC_SUPABASE_URL, publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY });
  return result.success ? result.data : null;
}

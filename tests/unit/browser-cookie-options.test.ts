import { afterEach, expect, it, vi } from 'vitest';
const client = vi.hoisted(() => vi.fn());
vi.mock('@supabase/ssr', () => ({ createBrowserClient: client }));
vi.mock('@/infrastructure/config/public-env', () => ({
  getPublicEnv: () => ({ url: 'https://example.supabase.co', publishableKey: 'test-only' }),
}));
import { createSupabaseBrowserClient } from '@/infrastructure/supabase/browser';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it.each(['https:', 'http:'])(
  'keeps application-wide browser refresh cookie attributes on %s',
  (protocol) => {
    vi.stubGlobal('window', { location: { protocol } });
    createSupabaseBrowserClient();
    expect(client).toHaveBeenCalledWith('https://example.supabase.co', 'test-only', {
      cookieOptions: { secure: protocol === 'https:', sameSite: 'lax', path: '/' },
    });
  },
);

import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';
import type { Database } from '@/infrastructure/supabase/database.types';
import { getPublicEnv } from '@/infrastructure/config/public-env';
import { appUrl } from '@/infrastructure/config/server-env';
import { guestCookieName, guestSecret } from '@/domain/guest/capability';
import { AppError } from '@/domain/shared/errors';

export function guestDatabase(token?: string) {
  const env = getPublicEnv();
  if (!env) throw new AppError('internal', 'Guest journey unavailable');
  // Deliberately isolated from Supabase Auth cookies. No elevated key or fabricated identity.
  return createClient<Database>(env.url, env.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: token ? { 'x-naql365-guest': guestSecret.parse(token) } : {} },
  });
}

function cookieName() {
  return appUrl().protocol === 'https:' ? `__Host-${guestCookieName}` : guestCookieName;
}

export async function guestSessionClient() {
  const token = guestSecret.safeParse((await cookies()).get(cookieName())?.value);
  if (!token.success) throw new AppError('unauthenticated', 'Journey unavailable');
  return guestDatabase(token.data);
}

export function guestDatabaseError(code: string): never {
  if (code === '42501') throw new AppError('forbidden', 'Journey unavailable');
  if (code === 'PT429') throw new AppError('rate_limited', 'Please retry later');
  if (code === 'PT409') throw new AppError('conflict', 'Request changed');
  if (['22023', '23514', '22P02', '55000', '54000'].includes(code))
    throw new AppError('validation', 'Check request data');
  throw new AppError('internal', 'Journey unavailable');
}

const accessState = z.object({ requestId: z.uuid(), expiresAt: z.iso.datetime({ offset: true }) });
export async function exchangeGuestSecret(token: string) {
  const client = guestDatabase(guestSecret.parse(token));
  const { data, error } = await client.rpc('guest_access_state');
  if (error) guestDatabaseError(error.code);
  const state = accessState.parse(data);
  const remaining = Math.floor((Date.parse(state.expiresAt) - Date.now()) / 1000);
  if (remaining <= 0) throw new AppError('forbidden', 'Journey unavailable');
  (await cookies()).set(cookieName(), token, {
    httpOnly: true,
    secure: appUrl().protocol === 'https:',
    sameSite: 'strict',
    path: '/',
    maxAge: Math.min(remaining, 90 * 86400),
  });
  return { requestId: state.requestId };
}

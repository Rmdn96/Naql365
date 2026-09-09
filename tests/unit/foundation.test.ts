import { describe, expect, it, vi, afterEach } from 'vitest';
import { authorize } from '@/application/identity/authorize';
import { safeRedirect } from '@/application/identity/redirects';
import { fileAccessInput, tenantInput } from '@/domain/shared/validation';
import { AppError, publicError } from '@/domain/shared/errors';
import { isLocale, direction, localizedPath } from '@/i18n/config';
import { dictionary } from '@/i18n/dictionaries';
import { getPublicEnv } from '@/infrastructure/config/public-env';
import { appUrl } from '@/infrastructure/config/server-env';

const principal = { userId: '10000000-0000-4000-8000-000000000001', organizationId: '20000000-0000-4000-8000-000000000001' };
afterEach(() => vi.unstubAllEnvs());
describe('server authorization service', () => {
  it('rejects anonymous callers without consulting the adapter', async () => {
    const hasPermission = vi.fn();
    await expect(authorize({hasPermission}, null, 'portal.access')).rejects.toMatchObject({code:'unauthenticated'});
    expect(hasPermission).not.toHaveBeenCalled();
  });
  it('fails closed for denied permission', async () => {
    await expect(authorize({hasPermission:async()=>false},principal,'finance.read')).rejects.toMatchObject({code:'forbidden'});
  });
  it('binds permission checks to the entire principal', async () => {
    const hasPermission = vi.fn(async()=>true);
    expect(await authorize({hasPermission},principal,'portal.access')).toEqual(principal);
    expect(hasPermission).toHaveBeenCalledWith(principal,'portal.access');
  });
  it('does not turn database outages into success', async () => {
    await expect(authorize({hasPermission:async()=>{throw new Error('offline');}},principal,'portal.access')).rejects.toThrow('offline');
  });
  it('rejects malformed tenant context', async () => {
    await expect(authorize({hasPermission:async()=>true},{...principal,organizationId:'invalid'},'portal.access')).rejects.toMatchObject({code:'validation'});
  });
});
describe('input and redirect validation', () => {
  it.each(['https://evil.example','//evil.example','/\\evil.example','/ar/%2f%2fevil.example','/ar/account?next=evil','/ar/account\r\nLocation: evil','javascript:alert(1)',null])('rejects unsafe redirect %s', value => {
    expect(safeRedirect(value,'ar')).toBe('/ar/account');
  });
  it('accepts only supported internal destinations',()=>expect(safeRedirect('/en/portal','ar')).toBe('/en/portal'));
  it('rejects unexpected authority fields',()=>expect(tenantInput.safeParse({...principal,role:'SUPER_ADMIN'}).success).toBe(false));
  it('rejects file paths in place of stable identifiers',()=>expect(fileAccessInput.safeParse({fileId:'../secret'}).success).toBe(false));
  it('never exposes internal exception messages',()=>expect(publicError(new Error('sensitive detail'))).toEqual({code:'internal'}));
  it('preserves safe typed error codes',()=>expect(publicError(new AppError('forbidden','private detail'))).toEqual({code:'forbidden'}));
});
describe('locale foundations', () => {
  it('uses exact locale identifiers',()=>{ expect(isLocale('ar')).toBe(true); expect(isLocale('AR')).toBe(false); expect(isLocale('fr')).toBe(false); });
  it('supports both directions and scoped routes',()=>{expect(direction('ar')).toBe('rtl');expect(direction('en')).toBe('ltr');expect(localizedPath('ar','/account')).toBe('/ar/account');});
  it('keeps translation keys aligned',()=>expect(Object.keys(dictionary('ar'))).toEqual(Object.keys(dictionary('en'))));
});
describe('environment boundaries',()=>{
  it('fails closed for absent Supabase configuration',()=>{vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','');vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','');expect(getPublicEnv()).toBeNull();});
  it('rejects insecure non-local Supabase origins',()=>{vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','http://example.com');vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','test-only');expect(getPublicEnv()).toBeNull();});
  it('requires a production canonical origin',()=>{vi.stubEnv('NODE_ENV','production');vi.stubEnv('APP_URL','');expect(()=>appUrl()).toThrow();});
  it.each(['https://example.com/path','https://user:pass@example.com','http://example.com'])('rejects unsafe canonical origin %s',origin=>{vi.stubEnv('APP_URL',origin);expect(()=>appUrl()).toThrow();});
});

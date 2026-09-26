import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { guestSecret } from '@/domain/guest/capability';

export function createGuestSecret(): string {
  return `g1_${randomBytes(32).toString('hex')}`;
}

export function guestVerifier(token: string): string {
  return createHash('sha256').update(guestSecret.parse(token), 'utf8').digest('hex');
}

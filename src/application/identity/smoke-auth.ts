import { signInInput } from '@/domain/shared/validation';
import { AppError } from '@/domain/shared/errors';

export interface SmokeAuthPort {
  signIn(email: string, password: string): Promise<boolean>;
  signOut(): Promise<boolean>;
}

export async function smokeSignIn(port: SmokeAuthPort, input: unknown): Promise<void> {
  const parsed = signInInput.safeParse(input);
  if (!parsed.success) throw new AppError('validation', 'Invalid sign-in input');
  if (!(await port.signIn(parsed.data.email, parsed.data.password))) {
    throw new AppError('unauthenticated', 'Sign-in failed');
  }
}

export function assertSameOrigin(origin: string | null, expected: string) {
  if (origin !== expected) throw new AppError('forbidden', 'Request origin rejected');
}

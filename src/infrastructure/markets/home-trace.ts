// Diagnostic-only wrappers. Never inspect messages, stacks, payloads or request metadata.
import 'server-only';
import { z } from 'zod';
import { AppError } from '@/domain/shared/errors';
import { catalogTrace } from '@/infrastructure/store/catalog-trace';

type Stage =
  | 'home-locale'
  | 'home-market'
  | 'home-catalogue'
  | 'public-catalogue-client'
  | 'public-catalogue-rpc'
  | 'public-catalogue-parse'
  | 'home-compose';
export function safeHomeException(error: unknown) {
  try {
    if (error instanceof AppError) {
      const code = z
        .enum([
          'validation',
          'unauthenticated',
          'forbidden',
          'not_found',
          'conflict',
          'rate_limited',
          'network',
          'internal',
        ])
        .safeParse(error.code);
      return { exception: 'AppError' as const, ...(code.success ? { appCode: code.data } : {}) };
    }
    if (error instanceof z.ZodError) return { exception: 'ZodError' as const };
    if (error instanceof TypeError) return { exception: 'TypeError' as const };
    if (error instanceof RangeError) return { exception: 'RangeError' as const };
    if (error instanceof SyntaxError) return { exception: 'SyntaxError' as const };
    if (error instanceof ReferenceError) return { exception: 'ReferenceError' as const };
    return { exception: error instanceof Error ? ('Error' as const) : ('Unknown' as const) };
  } catch {
    return { exception: 'Unknown' as const };
  }
}
export async function homeStep<T>(stage: Stage, operation: () => T | PromiseLike<T>): Promise<T> {
  catalogTrace({ stage, outcome: 'started' });
  try {
    const result = await operation();
    catalogTrace({ stage, outcome: 'ready' });
    return result;
  } catch (error) {
    catalogTrace({ stage, outcome: 'threw', ...safeHomeException(error) });
    throw error;
  }
}
export function homeSyncStep<T>(stage: Stage, operation: () => T): T {
  catalogTrace({ stage, outcome: 'started' });
  try {
    const result = operation();
    catalogTrace({ stage, outcome: 'ready' });
    return result;
  } catch (error) {
    catalogTrace({ stage, outcome: 'threw', ...safeHomeException(error) });
    throw error;
  }
}

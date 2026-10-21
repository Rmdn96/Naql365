import { afterEach, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AppError } from '@/domain/shared/errors';
const trace = vi.hoisted(() => vi.fn());
vi.mock('@/infrastructure/store/catalog-trace', () => ({ catalogTrace: trace }));
import { homeStep, homeSyncStep, safeHomeException } from '@/infrastructure/markets/home-trace';
afterEach(() => vi.clearAllMocks());
it.each([
  [new TypeError('private'), 'TypeError'],
  [new RangeError('private'), 'RangeError'],
  [new SyntaxError('private'), 'SyntaxError'],
  [new ReferenceError('private'), 'ReferenceError'],
  [new Error('private'), 'Error'],
  [{ message: 'private', name: 'TypeError' }, 'Unknown'],
  [new z.ZodError([]), 'ZodError'],
])('classifies without exposing messages or arbitrary names', (error, exception) => {
  expect(safeHomeException(error)).toEqual({ exception });
});
it('allowlists application codes without exposing error content', () => {
  expect(safeHomeException(new AppError('internal', 'private'))).toEqual({
    exception: 'AppError',
    appCode: 'internal',
  });
  expect(safeHomeException(new AppError('private' as never, 'private'))).toEqual({
    exception: 'AppError',
  });
});
it('preserves successful operation results and records bounded boundaries', async () => {
  const value = { private: true };
  expect(await homeStep('home-market', () => value)).toBe(value);
  expect(homeSyncStep('home-compose', () => value)).toBe(value);
  expect(trace.mock.calls).toEqual([
    [{ stage: 'home-market', outcome: 'started' }],
    [{ stage: 'home-market', outcome: 'ready' }],
    [{ stage: 'home-compose', outcome: 'started' }],
    [{ stage: 'home-compose', outcome: 'ready' }],
  ]);
});
it('preserves exact thrown error identity without swallowing or retrying', async () => {
  const error = new TypeError('private');
  const operation = vi.fn(() => {
    throw error;
  });
  await expect(homeStep('home-catalogue', operation)).rejects.toBe(error);
  expect(() => homeSyncStep('public-catalogue-parse', operation)).toThrow(error);
  expect(operation).toHaveBeenCalledTimes(2);
  expect(trace.mock.calls.filter(([event]) => event.outcome === 'threw')).toEqual([
    [{ stage: 'home-catalogue', outcome: 'threw', exception: 'TypeError' }],
    [{ stage: 'public-catalogue-parse', outcome: 'threw', exception: 'TypeError' }],
  ]);
});
it('does not replace the original exception if classification itself is inaccessible', async () => {
  const error = new Proxy(
    {},
    {
      getPrototypeOf() {
        throw Error('private');
      },
    },
  );
  expect(safeHomeException(error)).toEqual({ exception: 'Unknown' });
  try {
    await homeStep('home-market', () => {
      throw error;
    });
  } catch (caught) {
    expect(caught === error).toBe(true);
  }
});

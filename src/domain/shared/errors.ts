export type ErrorCode =
  | 'validation'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'network'
  | 'internal';
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
export type Result<T> = { ok: true; value: T } | { ok: false; code: ErrorCode };
export function publicError(error: unknown): { code: ErrorCode } {
  return { code: error instanceof AppError ? error.code : 'internal' };
}

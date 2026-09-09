import 'server-only';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AppError } from '@/domain/shared/errors';
import { assertSameOrigin } from '@/application/identity/smoke-auth';
import { appUrl } from '@/infrastructure/config/server-env';
export function checkOrigin(request: Request) {
  assertSameOrigin(request.headers.get('origin'), appUrl().origin);
}
export async function readJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new AppError('validation', 'Body required');
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.length;
      if (length > 65536) {
        await reader.cancel();
        throw new AppError('validation', 'Body too large');
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new AppError('validation', 'Invalid JSON');
  }
}
export async function apiResult(run: () => Promise<unknown>) {
  try {
    return NextResponse.json(await run(), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const code =
      error instanceof ZodError
        ? 'validation'
        : error instanceof AppError
          ? error.code
          : 'internal';
    const statuses = {
      validation: 400,
      unauthenticated: 401,
      forbidden: 403,
      not_found: 404,
      conflict: 409,
      network: 503,
      internal: 500,
    };
    return NextResponse.json(
      { error: code },
      { status: statuses[code], headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
}

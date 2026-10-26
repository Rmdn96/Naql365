import { expect, it } from 'vitest';
import { readJson } from '@/infrastructure/requests/http';

it('accepts JSON at the byte limit and cancels streamed overflow before parsing', async () => {
  const body = JSON.stringify('a'.repeat(65534));
  expect(new TextEncoder().encode(body)).toHaveLength(65536);
  expect(await readJson(new Request('http://localhost/api/store', { method: 'POST', body }))).toBe(
    'a'.repeat(65534),
  );
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(65537));
    },
    cancel() {
      cancelled = true;
    },
  });
  await expect(readJson({ body: stream } as Request)).rejects.toThrow('Body too large');
  expect(cancelled).toBe(true);
});

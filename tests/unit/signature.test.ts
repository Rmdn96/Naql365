import { expect, it } from 'vitest';
import sharp from 'sharp';
import { normalizeSignature } from '@/infrastructure/operations/signature';
it('rejects a fake signature with only image magic bytes', async () => {
  await expect(
    normalizeSignature(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), 'image/png'),
  ).rejects.toMatchObject({ code: 'validation' });
});
it('decodes signature evidence and strips unnecessary image metadata', async () => {
  const jpeg = await sharp({
    create: { width: 32, height: 16, channels: 3, background: '#ffffff' },
  })
    .jpeg()
    .toBuffer();
  const result = await normalizeSignature(jpeg, 'image/jpeg');
  const metadata = await sharp(result).metadata();
  expect(metadata.format).toBe('png');
  expect(metadata.exif).toBeUndefined();
  expect(metadata.width).toBe(32);
  await expect(normalizeSignature(jpeg, 'image/png')).rejects.toMatchObject({ code: 'validation' });
});

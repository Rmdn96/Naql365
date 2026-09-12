import 'server-only';
import sharp from 'sharp';
import { imageMime } from '@/domain/requests/intake';
import { AppError } from '@/domain/shared/errors';

// Sharp is pinned to the already installed Next.js-compatible version. Decode and
// re-encode evidence rather than accepting a MIME header or magic bytes alone.
export async function normalizeSignature(input: Uint8Array, declaredMime: string) {
  try {
    if (input.length < 1 || input.length > 2097152) throw new Error();
    const detected = imageMime(input);
    if (!detected || detected !== declaredMime || !['image/png', 'image/jpeg'].includes(detected))
      throw new Error();
    const decoder = sharp(input, { limitInputPixels: 8_000_000, failOn: 'warning' });
    const metadata = await decoder.metadata();
    if ((metadata.pages ?? 1) !== 1 || !metadata.width || !metadata.height) throw new Error();
    // Default Sharp output strips EXIF and other unnecessary external metadata.
    const output = await decoder.rotate().png().toBuffer();
    if (output.length > 2097152) throw new Error();
    return output;
  } catch {
    throw new AppError('validation', 'Invalid signature image');
  }
}

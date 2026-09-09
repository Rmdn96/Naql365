import { NextResponse } from 'next/server';
import { stagingAuthEnabled } from '@/infrastructure/config/deployment-env';
import { signedFileUrl } from '@/infrastructure/storage/read-file';
import { publicError } from '@/domain/shared/errors';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };
  if (!stagingAuthEnabled()) return new NextResponse(null, { status: 404, headers });
  try {
    const { id } = await params;
    return NextResponse.redirect(await signedFileUrl({ fileId: id }), { status: 302, headers });
  } catch (error) {
    const { code } = publicError(error);
    return NextResponse.json(
      { code },
      {
        status:
          code === 'unauthenticated'
            ? 401
            : code === 'validation'
              ? 400
              : code === 'not_found'
                ? 404
                : 500,
        headers,
      },
    );
  }
}

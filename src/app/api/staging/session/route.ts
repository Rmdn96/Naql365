import { NextResponse } from 'next/server';
import { stagingAuthEnabled } from '@/infrastructure/config/deployment-env';
import { portalAccess } from '@/infrastructure/identity/access';
export const dynamic = 'force-dynamic';
export async function GET() {
  const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };
  if (!stagingAuthEnabled()) return new NextResponse(null, { status: 404, headers });
  const result = await portalAccess('account.access');
  const status =
    result.status === 'authorized'
      ? 200
      : result.status === 'unauthenticated'
        ? 401
        : result.status === 'forbidden'
          ? 403
          : 503;
  return NextResponse.json({ status: result.status }, { status, headers });
}

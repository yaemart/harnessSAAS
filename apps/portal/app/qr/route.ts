import { NextRequest, NextResponse } from 'next/server';
import { recordQRScan, UUID_RE } from '@/lib/api';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const commodityId = searchParams.get('c');
  const source = searchParams.get('src') ?? 'package';

  if (!commodityId || !UUID_RE.test(commodityId)) {
    return NextResponse.json({ error: 'Missing or invalid commodity id' }, { status: 400 });
  }

  try {
    await recordQRScan(commodityId, source);
  } catch {
    // Non-blocking: scan recording failure should not prevent redirect
  }

  const redirectUrl = new URL(`/p/${commodityId}`, request.url);
  return NextResponse.redirect(redirectUrl, 302);
}

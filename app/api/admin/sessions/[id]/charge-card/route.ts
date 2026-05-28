export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { source_id } = await request.json();

  const portalUrl = process.env.PORTAL_URL || 'https://www.legacylandandcattleco.com';

  const res = await fetch(`${portalUrl}/api/payments/create-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: id,
      source_id,
    }),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

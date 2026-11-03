export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { sendPaymentReminder } from '@/lib/payment-reminder';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await sendPaymentReminder(id);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, ...result });
}

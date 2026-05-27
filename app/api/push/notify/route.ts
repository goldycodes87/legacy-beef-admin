export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { sendPushNotification } from '@/lib/push';

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-notify-secret');
  if (secret !== process.env.ADMIN_NOTIFY_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { title, body, url } = await request.json();
  await sendPushNotification(title, body, url);
  return NextResponse.json({ success: true });
}

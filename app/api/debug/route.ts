export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    has_password: !!process.env.LEGACY_BEEF_ADMIN_PASSWORD,
    password_length: process.env.LEGACY_BEEF_ADMIN_PASSWORD?.length ?? 0,
    node_env: process.env.NODE_ENV,
  });
}

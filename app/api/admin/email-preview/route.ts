export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { EMAIL_TEMPLATES, previewEmail } from '@/lib/email-content';

/**
 * Renders the real template with sample data.
 *
 * This route used to hold its own hand-written copy of every email, so the
 * preview and the thing customers received drifted apart — the preview showed a
 * polished "your beef is ready" while the live one was unbranded HTML quoting a
 * hardcoded $8.25/lb. There is one implementation now, in email-content.ts, and
 * both this and the sending routes build from it.
 */
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type');

  // No type: list what there is, so the page never hardcodes the menu either.
  if (!type) {
    return NextResponse.json({
      templates: Object.entries(EMAIL_TEMPLATES).map(([id, t]) => ({
        id,
        label: t.label,
        when: t.when,
      })),
    });
  }

  const email = previewEmail(type);
  if (!email) {
    return NextResponse.json({ error: `Unknown email template: ${type}` }, { status: 404 });
  }

  return NextResponse.json(email);
}

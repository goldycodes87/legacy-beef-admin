import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Rusty's expanded hands: the business operations behind the wider toolset.
 *
 * Wherever the admin already has a route encoding the business rules —
 * confirming deposits, recording payments, hanging weights, moving or
 * cancelling reservations — the tool calls that route handler IN-PROCESS
 * (imported and invoked, not fetched), so emails, pushes, capacity math and
 * status transitions are exactly the ones a human tap produces. Nothing here
 * opens a new way into the app from outside: these run only inside the agent,
 * whose channels each carry their own auth, and only after Grant approves.
 */

import { POST as confirmDepositRoute } from '@/app/api/admin/sessions/[id]/confirm-deposit/route';
import { POST as recordPaymentRoute } from '@/app/api/admin/sessions/[id]/record-payment/route';
import { POST as hangingWeightRoute } from '@/app/api/admin/sessions/[id]/hanging-weight/route';
import { POST as markReadyRoute } from '@/app/api/admin/sessions/[id]/mark-ready/route';
import { POST as pickedUpRoute } from '@/app/api/admin/sessions/[id]/picked-up/route';
import { POST as markBalancePaidRoute } from '@/app/api/admin/sessions/[id]/mark-balance-paid/route';
import { POST as discountRoute } from '@/app/api/admin/sessions/[id]/discount/route';
import { POST as moveRoute } from '@/app/api/admin/sessions/[id]/move/route';
import { POST as cancelRoute } from '@/app/api/admin/sessions/[id]/cancel/route';
import { POST as sendCutSheetEmailRoute } from '@/app/api/admin/sessions/[id]/send-cut-sheet-email/route';

type Json = Record<string, unknown>;

type SessionRouteHandler = (
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) => Promise<Response>;

const SESSION_ROUTES: Record<string, SessionRouteHandler> = {
  'confirm-deposit': confirmDepositRoute as SessionRouteHandler,
  'record-payment': recordPaymentRoute as SessionRouteHandler,
  'hanging-weight': hangingWeightRoute as SessionRouteHandler,
  'mark-ready': markReadyRoute as SessionRouteHandler,
  'picked-up': pickedUpRoute as SessionRouteHandler,
  'mark-balance-paid': markBalancePaidRoute as SessionRouteHandler,
  discount: discountRoute as SessionRouteHandler,
  move: moveRoute as SessionRouteHandler,
  cancel: cancelRoute as SessionRouteHandler,
  'send-cut-sheet-email': sendCutSheetEmailRoute as SessionRouteHandler,
};

export async function callSessionRoute(
  route: keyof typeof SESSION_ROUTES,
  sessionId: string,
  body: Json = {}
): Promise<Json> {
  const handler = SESSION_ROUTES[route];
  const request = new NextRequest(`http://internal/api/admin/sessions/${sessionId}/${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const response = await handler(request, { params: Promise.resolve({ id: sessionId }) });
  const data = (await response.json().catch(() => ({}))) as Json;
  if (!response.ok) {
    return { error: (data.error as string) || `${route} failed (${response.status})` };
  }
  return data;
}

/**
 * Turns "Brenda" / "brfamily2sea@gmail.com" into one session id. Ambiguity is
 * an error listing the candidates, so the model asks Grant instead of
 * guessing which customer's money to touch.
 */
export async function resolveSession(
  customerQuery: string,
  opts: { includeDone?: boolean } = {}
): Promise<{ sessionId?: string; customer?: string; error?: string; candidates?: unknown[] }> {
  const supabase = getSupabaseAdmin();
  const q = `%${customerQuery.trim()}%`;

  // A raw UUID is already a session id.
  if (/^[0-9a-f-]{36}$/i.test(customerQuery.trim())) {
    return { sessionId: customerQuery.trim() };
  }

  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, email')
    .or(`name.ilike.${q},email.ilike.${q}`)
    .limit(5);

  if (!customers || customers.length === 0) {
    return { error: `No customer matched "${customerQuery}".` };
  }

  const all: Array<{ sessionId: string; customer: string; label: string }> = [];
  for (const c of customers) {
    let query = supabase
      .from('sessions')
      .select('id, status, purchase_type, created_at, animals(name, butcher_date)')
      .eq('customer_id', c.id)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false });
    if (!opts.includeDone) query = query.neq('status', 'picked_up');
    const { data: sessions } = await query;
    for (const s of sessions || []) {
      const animal = Array.isArray((s as any).animals) ? (s as any).animals[0] : (s as any).animals;
      all.push({
        sessionId: s.id,
        customer: c.name,
        label: `${c.name} — ${s.purchase_type} — ${animal?.name || '?'} (${s.status}) [session ${s.id}]`,
      });
    }
  }

  if (all.length === 0) return { error: `${customers[0].name} has no active reservations.` };
  if (all.length > 1) {
    return {
      error: 'More than one reservation matches — ask Grant which one, then pass its session id.',
      candidates: all.map((a) => a.label),
    };
  }
  return { sessionId: all[0].sessionId, customer: all[0].customer };
}

/** Sends a one-off branded email to a customer, from orders@. */
export async function sendCustomerEmail(input: {
  to: string;
  subject: string;
  message: string;
}): Promise<Json> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey || resendKey === 're_placeholder_set_in_vercel') {
    return { error: 'RESEND_API_KEY is not configured.' };
  }
  const { emailBase } = await import('@/lib/email-templates');
  const paragraphs = input.message
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="color:#374151;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;margin:0 0 16px;">${p
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/\n/g, '<br>')}</p>`
    )
    .join('');
  const { Resend } = await import('resend');
  const resend = new Resend(resendKey);
  const { error } = await resend.emails.send({
    from: 'Legacy Land & Cattle <orders@legacylandandcattleco.com>',
    to: input.to,
    subject: input.subject,
    html: emailBase(paragraphs, input.subject),
  });
  if (error) return { error: String((error as { message?: string }).message || error) };
  return { sent: true, to: input.to, subject: input.subject };
}

/** Texts a customer from the ranch number via Twilio. */
export async function textCustomer(input: { phone: string; message: string }): Promise<Json> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    return { error: 'Twilio is not configured (TWILIO_ACCOUNT_SID / AUTH_TOKEN / FROM_NUMBER).' };
  }
  const digits = input.phone.replace(/[^\d]/g, '');
  const to = digits.length === 10 ? `+1${digits}` : digits.length === 11 ? `+${digits}` : null;
  if (!to) return { error: `"${input.phone}" does not look like a US phone number.` };

  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ From: from, To: to, Body: input.message.slice(0, 1600) }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return { error: `Twilio refused the message (${res.status}): ${detail.slice(0, 200)}` };
  }
  return { sent: true, to };
}

export async function recordExpense(input: {
  amount: number;
  category: string;
  note?: string;
  butcher_date?: string;
  animal_type?: string;
  spent_on?: string;
}): Promise<Json> {
  if (!(input.amount > 0)) return { error: 'Amount must be greater than zero.' };
  const category = ['steer', 'processing', 'feed', 'transport', 'other'].includes(input.category)
    ? input.category
    : 'other';
  const { data, error } = await getSupabaseAdmin()
    .from('expenses')
    .insert({
      category,
      amount_cents: Math.round(input.amount * 100),
      note: input.note || null,
      butcher_date: input.butcher_date || null,
      animal_type: input.animal_type || null,
      ...(input.spent_on ? { spent_on: input.spent_on } : {}),
    })
    .select('id, category, amount_cents, spent_on')
    .single();
  if (error) return { error: error.message };
  return { recorded: data };
}

export async function expensesReport(): Promise<Json> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('expenses')
    .select('category, amount_cents, note, butcher_date, animal_type, spent_on')
    .order('spent_on', { ascending: false })
    .limit(100);
  if (error) return { error: error.message };
  const byCategory: Record<string, number> = {};
  for (const e of data || []) {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount_cents;
  }
  return {
    total_dollars:
      (data || []).reduce((sum, e) => sum + e.amount_cents, 0) / 100,
    by_category_dollars: Object.fromEntries(
      Object.entries(byCategory).map(([k, v]) => [k, v / 100])
    ),
    recent: (data || []).slice(0, 20).map((e) => ({ ...e, amount: e.amount_cents / 100 })),
  };
}

export async function upcomingPickups(): Promise<Json> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('pickup_appointments')
    .select(
      `pickup_person_name, pickup_person_phone, confirmed_at,
       pickup_windows(*),
       sessions(purchase_type, status, balance_paid, customers(name, phone))`
    )
    .order('created_at', { ascending: false })
    .limit(40);
  if (error) return { error: error.message };
  return { appointments: data || [] };
}

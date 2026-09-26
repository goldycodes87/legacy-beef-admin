import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { computeBalance } from '@/lib/money';

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

/**
 * Turns "Brenda" / an email / a customer uuid into one customers row.
 * Same contract as resolveSession: ambiguity is an error listing candidates.
 */
export async function resolveCustomer(
  customerQuery: string
): Promise<{ id?: string; name?: string; email?: string; error?: string; candidates?: string[] }> {
  const supabase = getSupabaseAdmin();
  const trimmed = customerQuery.trim();

  if (/^[0-9a-f-]{36}$/i.test(trimmed)) {
    const { data } = await supabase
      .from('customers')
      .select('id, name, email')
      .eq('id', trimmed)
      .maybeSingle();
    if (data) return data;
    // Fall through: it might have been a session id — look up its customer.
    const { data: session } = await supabase
      .from('sessions')
      .select('customers(id, name, email)')
      .eq('id', trimmed)
      .maybeSingle();
    const c = Array.isArray((session as any)?.customers)
      ? (session as any).customers[0]
      : (session as any)?.customers;
    if (c) return c;
    return { error: `No customer matched that id.` };
  }

  const q = `%${trimmed}%`;
  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, email')
    .or(`name.ilike.${q},email.ilike.${q}`)
    .limit(5);

  if (!customers || customers.length === 0) {
    return { error: `No customer matched "${customerQuery}".` };
  }
  if (customers.length > 1) {
    return {
      error: 'More than one customer matches — ask Grant which one, then pass their email or id.',
      candidates: customers.map((c) => `${c.name} <${c.email}> [${c.id}]`),
    };
  }
  return customers[0];
}

/** Updates only the contact fields Grant asked to change; reports before/after. */
export async function updateCustomerInfo(input: {
  customer: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
}): Promise<Json> {
  const resolved = await resolveCustomer(input.customer);
  if (!resolved.id) return { error: resolved.error, candidates: resolved.candidates };

  const supabase = getSupabaseAdmin();
  const fields = ['name', 'email', 'phone', 'address', 'city', 'state', 'zip'] as const;
  const changes: Record<string, string> = {};
  for (const f of fields) {
    const v = input[f];
    if (typeof v === 'string' && v.trim()) changes[f] = v.trim();
  }
  if (Object.keys(changes).length === 0) return { error: 'No fields to change were given.' };
  if (changes.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(changes.email)) {
    return { error: `"${changes.email}" does not look like an email address.` };
  }

  const { data: before } = await supabase
    .from('customers')
    .select('name, email, phone, address, city, state, zip')
    .eq('id', resolved.id)
    .single();

  const { error } = await supabase.from('customers').update(changes).eq('id', resolved.id);
  if (error) return { error: error.message };

  const previous: Record<string, unknown> = {};
  for (const k of Object.keys(changes)) previous[k] = (before as any)?.[k] ?? null;
  return { updated: resolved.name, previous, now: changes };
}

// ─── Coupons ─────────────────────────────────────────────────────────────────

const COUPON_TYPES = ['fixed_amount', 'percentage', 'waive_deposit', 'percent_off_balance'];

export async function listCoupons(): Promise<Json> {
  const { data, error } = await getSupabaseAdmin()
    .from('coupon_codes')
    .select('code, type, value, single_use, redeemed, expires_at, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return { error: error.message };
  return { coupons: data || [] };
}

export async function createCoupon(input: {
  code: string;
  type: string;
  value?: number;
  expires_at?: string;
  single_use?: boolean;
}): Promise<Json> {
  if (!COUPON_TYPES.includes(input.type)) {
    return { error: `type must be one of: ${COUPON_TYPES.join(', ')}` };
  }
  const needsValue = input.type === 'fixed_amount' || input.type.includes('percent');
  if (needsValue && !(Number(input.value) > 0)) {
    return { error: 'This coupon type needs a value greater than zero.' };
  }
  if (input.type.includes('percent') && Number(input.value) > 100) {
    return { error: 'A percentage coupon cannot exceed 100.' };
  }
  const code = input.code.trim().toUpperCase();
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase
    .from('coupon_codes')
    .select('id')
    .eq('code', code)
    .maybeSingle();
  if (existing) return { error: `Coupon ${code} already exists.` };

  const { data, error } = await supabase
    .from('coupon_codes')
    .insert({
      code,
      type: input.type,
      value: needsValue ? Number(input.value) : 0,
      expires_at: input.expires_at || null,
      single_use: input.single_use ?? true,
      redeemed: false,
    })
    .select('code, type, value, single_use, expires_at')
    .single();
  if (error) return { error: error.message };
  return { created: data };
}

export async function deleteCoupon(input: { code: string }): Promise<Json> {
  const supabase = getSupabaseAdmin();
  const code = input.code.trim().toUpperCase();
  const { data: coupon } = await supabase
    .from('coupon_codes')
    .select('id, code, type, value, redeemed')
    .eq('code', code)
    .maybeSingle();
  if (!coupon) return { error: `No coupon named ${code}.` };
  if (coupon.redeemed) {
    return {
      error: `${code} has been redeemed — it is part of an order's record now. Leave it; it cannot be used again.`,
    };
  }
  const { error } = await supabase.from('coupon_codes').delete().eq('id', coupon.id);
  if (error) return { error: error.message };
  return { deleted: coupon.code, was: `${coupon.type} ${coupon.value}` };
}

// ─── Pickup windows ──────────────────────────────────────────────────────────

const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function listPickupWindows(): Promise<Json> {
  const supabase = getSupabaseAdmin();
  const { data: windows, error } = await supabase
    .from('pickup_windows')
    .select('id, label, pickup_date, start_time, end_time, max_slots, active')
    .order('pickup_date', { ascending: true })
    .order('start_time', { ascending: true });
  if (error) return { error: error.message };

  const { data: appts } = await supabase.from('pickup_appointments').select('window_id');
  const counts: Record<string, number> = {};
  for (const a of appts || []) {
    if (a.window_id) counts[a.window_id] = (counts[a.window_id] || 0) + 1;
  }
  return {
    windows: (windows || []).map((w) => ({ ...w, appointments_booked: counts[w.id] || 0 })),
  };
}

export async function createPickupWindow(input: {
  label?: string;
  pickup_date: string;
  start_time: string;
  end_time: string;
  max_slots?: number;
}): Promise<Json> {
  if (!DATE_RE.test(input.pickup_date)) return { error: 'pickup_date must be YYYY-MM-DD' };
  if (!TIME_RE.test(input.start_time) || !TIME_RE.test(input.end_time)) {
    return { error: 'start_time and end_time must be 24h HH:MM' };
  }
  if (input.end_time <= input.start_time) return { error: 'end_time must be after start_time.' };

  const { data, error } = await getSupabaseAdmin()
    .from('pickup_windows')
    .insert({
      label: input.label || `Pickup ${input.pickup_date}`,
      pickup_date: input.pickup_date,
      start_time: input.start_time,
      end_time: input.end_time,
      max_slots: input.max_slots || 999,
      active: true,
    })
    .select('id, label, pickup_date, start_time, end_time, max_slots')
    .single();
  if (error) return { error: error.message };
  return { created: data, note: 'Customers can book it as soon as their beef is marked ready.' };
}

/** Finds one window by date (plus optional label/time when a date has several). */
async function resolvePickupWindow(
  pickupDate: string,
  hint?: string
): Promise<{ window?: Json & { id: string }; error?: string; candidates?: string[] }> {
  if (!DATE_RE.test(pickupDate)) return { error: 'pickup_date must be YYYY-MM-DD' };
  const { data: windows } = await getSupabaseAdmin()
    .from('pickup_windows')
    .select('id, label, pickup_date, start_time, end_time, max_slots, active')
    .eq('pickup_date', pickupDate)
    .order('start_time');
  let matches = windows || [];
  if (matches.length > 1 && hint) {
    const h = hint.toLowerCase();
    matches = matches.filter(
      (w) => (w.label || '').toLowerCase().includes(h) || String(w.start_time).startsWith(hint)
    );
  }
  if (matches.length === 0) return { error: `No pickup window found on ${pickupDate}.` };
  if (matches.length > 1) {
    return {
      error: 'That date has more than one window — ask Grant which (give its label or start time).',
      candidates: matches.map((w) => `${w.label} ${w.start_time}–${w.end_time} [${w.id}]`),
    };
  }
  return { window: matches[0] as Json & { id: string } };
}

export async function updatePickupWindow(input: {
  pickup_date: string;
  which?: string;
  new_label?: string;
  new_date?: string;
  new_start_time?: string;
  new_end_time?: string;
  new_max_slots?: number;
  active?: boolean;
}): Promise<Json> {
  const found = await resolvePickupWindow(input.pickup_date, input.which);
  if (!found.window) return { error: found.error, candidates: found.candidates };

  const changes: Record<string, unknown> = {};
  if (input.new_label) changes.label = input.new_label;
  if (input.new_date) {
    if (!DATE_RE.test(input.new_date)) return { error: 'new_date must be YYYY-MM-DD' };
    changes.pickup_date = input.new_date;
  }
  if (input.new_start_time) {
    if (!TIME_RE.test(input.new_start_time)) return { error: 'new_start_time must be HH:MM' };
    changes.start_time = input.new_start_time;
  }
  if (input.new_end_time) {
    if (!TIME_RE.test(input.new_end_time)) return { error: 'new_end_time must be HH:MM' };
    changes.end_time = input.new_end_time;
  }
  if (typeof input.new_max_slots === 'number') changes.max_slots = input.new_max_slots;
  if (typeof input.active === 'boolean') changes.active = input.active;
  if (Object.keys(changes).length === 0) return { error: 'No changes were given.' };

  // Anyone already booked into this window planned around its old time.
  const { count } = await getSupabaseAdmin()
    .from('pickup_appointments')
    .select('id', { count: 'exact', head: true })
    .eq('window_id', found.window.id);

  const { error } = await getSupabaseAdmin()
    .from('pickup_windows')
    .update(changes)
    .eq('id', found.window.id);
  if (error) return { error: error.message };

  return {
    updated: found.window.label,
    changes,
    ...(count
      ? {
          warning: `${count} customer(s) already booked this window — if the date or time moved, they should be told.`,
        }
      : {}),
  };
}

export async function deletePickupWindow(input: {
  pickup_date: string;
  which?: string;
}): Promise<Json> {
  const found = await resolvePickupWindow(input.pickup_date, input.which);
  if (!found.window) return { error: found.error, candidates: found.candidates };

  // Same guard as the admin's delete button: never orphan booked appointments.
  const { count } = await getSupabaseAdmin()
    .from('pickup_appointments')
    .select('id', { count: 'exact', head: true })
    .eq('window_id', found.window.id);
  if (count && count > 0) {
    return {
      error: `Refused: ${count} appointment(s) are booked into that window. Move or cancel them first, or deactivate the window instead.`,
    };
  }

  const { error } = await getSupabaseAdmin()
    .from('pickup_windows')
    .delete()
    .eq('id', found.window.id);
  if (error) return { error: error.message };
  return { deleted: `${found.window.label} (${found.window.pickup_date})` };
}

// ─── Pricing preview ─────────────────────────────────────────────────────────

/**
 * What-if math for a hanging weight, using the exact computeBalance the real
 * hanging-weight entry uses. Reads only — nothing is saved, nothing is sent.
 */
export async function previewPricing(input: {
  customer: string;
  weight_lbs: number;
}): Promise<Json> {
  const resolved = await resolveSession(input.customer);
  if (!resolved.sessionId) return { error: resolved.error, candidates: resolved.candidates };

  const weight = Number(input.weight_lbs);
  if (!Number.isFinite(weight) || weight <= 0) return { error: 'weight_lbs must be a positive number.' };

  const { data: session } = await getSupabaseAdmin()
    .from('sessions')
    .select(
      `purchase_type, price_per_lb, discount_amount, discount_note, hanging_weight_lbs,
       customers(name), animals(name, price_per_lb, butcher_date),
       payments(amount_cents, surcharge_cents, type, status)`
    )
    .eq('id', resolved.sessionId)
    .single();
  if (!session) return { error: 'Could not load that reservation.' };

  const animal = Array.isArray((session as any).animals)
    ? (session as any).animals[0]
    : (session as any).animals;
  const pricePerLb =
    parseFloat((session as any).price_per_lb) || parseFloat(animal?.price_per_lb) || 0;
  if (!pricePerLb) return { error: 'No price per lb is set on this reservation or its butcher date.' };

  const breakdown = computeBalance({
    hangingWeightLbs: weight,
    pricePerLb,
    payments: (session as any).payments || [],
    discountAmount: (session as any).discount_amount,
  });

  return {
    preview_only: 'Nothing was saved and no email was sent.',
    customer: resolved.customer,
    order: `${(session as any).purchase_type} — ${animal?.name || '?'}`,
    hanging_weight_lbs: weight,
    price_per_lb: pricePerLb,
    total_cost: breakdown.totalCost,
    deposit_credit: breakdown.depositCredit,
    discount: breakdown.discount,
    balance_due: breakdown.balanceDue,
    ...((session as any).hanging_weight_lbs
      ? { already_entered: `${(session as any).hanging_weight_lbs} lbs is already on file for this order.` }
      : {}),
    ...(weight < 50 || weight > 1200
      ? { warning: 'That weight is outside the 50–1200 lb range the real entry accepts.' }
      : {}),
  };
}

// ─── Email history ───────────────────────────────────────────────────────────

/**
 * Did this customer get their emails? Two sources: the app's own send log
 * (notifications rows written when an email goes out) and Resend delivery
 * events (email_events, filled by the webhook once configured).
 */
export async function checkCustomerEmails(input: { customer: string }): Promise<Json> {
  const resolved = await resolveCustomer(input.customer);
  if (!resolved.id) return { error: resolved.error, candidates: resolved.candidates };

  const supabase = getSupabaseAdmin();
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id')
    .eq('customer_id', resolved.id);
  const sessionIds = (sessions || []).map((s) => s.id);

  const [{ data: sends }, { data: events }] = await Promise.all([
    sessionIds.length > 0
      ? supabase
          .from('notifications')
          .select('type, channel, status, sent_at')
          .in('session_id', sessionIds)
          .order('sent_at', { ascending: false })
          .limit(25)
      : Promise.resolve({ data: [] as unknown[] }),
    supabase
      .from('email_events')
      .select('event_type, subject, created_at')
      .eq('to_email', (resolved.email || '').toLowerCase())
      .order('created_at', { ascending: false })
      .limit(25),
  ]);

  return {
    customer: `${resolved.name} <${resolved.email}>`,
    sent_by_app: sends || [],
    delivery_events: events || [],
    note:
      (events || []).length === 0
        ? 'Delivery events come from the Resend webhook; if it is not configured yet, only the app send log shows. Not every email writes a send-log row, so an empty log is not proof nothing went out.'
        : 'Delivery events are from Resend and cover every email, including opens/bounces where reported.',
  };
}

// ─── Finances (the Financials tab) ───────────────────────────────────────────

const ANIMAL_COST_TYPES = ['purchase', 'feed', 'butcher', 'other'];

/** Adds a cost line to an animal — the same rows the Financials tab shows. */
export async function recordAnimalCost(input: {
  butcher_date: string;
  animal_type: string;
  cost_type: string;
  amount: number;
  description?: string;
  date?: string;
}): Promise<Json> {
  if (!ANIMAL_COST_TYPES.includes(input.cost_type)) {
    return { error: `cost_type must be one of: ${ANIMAL_COST_TYPES.join(', ')}` };
  }
  if (!(Number(input.amount) > 0)) return { error: 'Amount must be greater than zero.' };

  const supabase = getSupabaseAdmin();
  const { data: animal } = await supabase
    .from('animals')
    .select('id, name')
    .eq('butcher_date', input.butcher_date)
    .eq('animal_type', input.animal_type)
    .neq('status', 'archived')
    .maybeSingle();
  if (!animal) return { error: 'No butcher date found for that date and type.' };

  const { data, error } = await supabase
    .from('animal_costs')
    .insert({
      animal_id: animal.id,
      type: input.cost_type,
      description: input.description || null,
      amount: Number(input.amount),
      date: input.date || new Date().toISOString().slice(0, 10),
    })
    .select('type, description, amount, date')
    .single();
  if (error) return { error: error.message };
  return { recorded_on: animal.name, cost: data, note: 'Shows on the Financials tab immediately.' };
}

/** The Financials tab as numbers: per-animal costs, collected revenue, margin. */
export async function financesReport(): Promise<Json> {
  const supabase = getSupabaseAdmin();
  const [{ data: animals }, { data: sessions }] = await Promise.all([
    supabase
      .from('animals')
      .select('id, name, butcher_date, animal_type, home_raised, animal_costs(type, description, amount, date)')
      .order('butcher_date', { ascending: false }),
    supabase
      .from('sessions')
      .select('animal_id, purchase_type, balance_due, status, payments(amount_cents, surcharge_cents, status)')
      .not('status', 'in', '("cancelled","draft")'),
  ]);

  // Revenue counts what customers actually paid, net of the card surcharge —
  // the surcharge goes to the processor, not the ranch. Same math as the tab.
  const revenueByAnimal: Record<string, number> = {};
  const outstandingByAnimal: Record<string, number> = {};
  for (const s of sessions || []) {
    const paid = ((s as any).payments || [])
      .filter((p: any) => p.status === 'paid')
      .reduce(
        (sum: number, p: any) =>
          sum + Math.max(0, (p.amount_cents || 0) - (p.surcharge_cents || 0)),
        0
      );
    revenueByAnimal[s.animal_id] = (revenueByAnimal[s.animal_id] || 0) + paid / 100;
    outstandingByAnimal[s.animal_id] =
      (outstandingByAnimal[s.animal_id] || 0) + (Number(s.balance_due) || 0);
  }

  let totalRevenue = 0;
  let totalCosts = 0;
  const perAnimal = (animals || []).map((a: any) => {
    const costs: AnimalCostRow[] = a.animal_costs || [];
    const costTotal = costs.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
    const byType: Record<string, number> = {};
    for (const c of costs) byType[c.type] = (byType[c.type] || 0) + (Number(c.amount) || 0);
    const revenue = revenueByAnimal[a.id] || 0;
    totalRevenue += revenue;
    totalCosts += costTotal;
    return {
      animal: a.name,
      butcher_date: a.butcher_date,
      type: a.animal_type,
      home_raised: !!a.home_raised,
      revenue_collected: revenue,
      still_owed: outstandingByAnimal[a.id] || 0,
      costs_by_type: byType,
      costs_total: costTotal,
      profit_so_far: revenue - costTotal,
      cost_lines: costs,
    };
  });

  return {
    totals: {
      revenue_collected: totalRevenue,
      costs: totalCosts,
      profit_so_far: totalRevenue - totalCosts,
    },
    animals: perAnimal,
  };
}

interface AnimalCostRow {
  type: string;
  description?: string | null;
  amount: number;
  date?: string | null;
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

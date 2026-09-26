import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { summarizeReservation } from '@/lib/reservation';
import { getStageMeta } from '@/lib/reservation-status';
import {
  callSessionRoute,
  resolveSession,
  sendCustomerEmail,
  textCustomer,
  upcomingPickups,
  updateCustomerInfo,
  listCoupons,
  createCoupon,
  deleteCoupon,
  listPickupWindows,
  createPickupWindow,
  updatePickupWindow,
  deletePickupWindow,
  previewPricing,
  checkCustomerEmails,
  recordAnimalCost,
  financesReport,
} from '@/lib/agent-ops';

/**
 * The admin agent's hands.
 *
 * Reads execute freely. Writes are listed in WRITE_TOOLS: the ask route stops
 * the loop when the model calls one, shows Grant exactly what it wants to do,
 * and only executes after his tap — then logs it to agent_actions. The agent
 * goes through the same guarded paths as the admin UI wherever they exist, so
 * it cannot invent a state the app couldn't reach on its own.
 */

const PURCHASE_LABEL: Record<string, string> = {
  whole: 'Whole Beef',
  half: 'Half Beef',
  quarter: 'Quarter Beef',
};

const TYPE_LABEL: Record<string, string> = {
  grass_fed: 'Grass-Fed',
  grain_finished: 'Grain-Finished',
  wagyu: 'Wagyu',
};

export const WRITE_TOOLS = new Set([
  'create_butcher_date',
  'adjust_capacity',
  'update_persona',
  'mark_deposit_received',
  'record_payment',
  'enter_hanging_weight',
  'mark_beef_ready',
  'mark_picked_up',
  'mark_balance_paid',
  'apply_discount',
  'move_reservation',
  'cancel_reservation',
  'send_cut_sheet_invite',
  'email_customer',
  'text_customer',
  'update_customer_info',
  'create_coupon',
  'delete_coupon',
  'create_pickup_window',
  'update_pickup_window',
  'delete_pickup_window',
  'record_animal_cost',
]);

/** Every session-scoped tool takes the customer the same way. */
const CUSTOMER_ARG = {
  customer: {
    type: 'string',
    description: 'Customer name, email, or a session id from an earlier lookup',
  },
} as const;

export const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'status_report',
    description:
      'Overall state of the business: upcoming butcher dates with capacity, every active reservation with its stage and money, and a needs-attention list (unpaid deposits with days waiting, unfinished cut sheets near a butcher date).',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'find_reservation',
    description:
      'Look up reservations by customer name or email (partial match). Returns full detail: order, stage, money, cut sheet state, and the email log for that customer.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Customer name or email, partial is fine' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'capacity',
    description:
      'Butcher-date capacity: every non-archived animal with total units, units used, and what is left in wholes/halves/quarters.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'email_log',
    description:
      'Recent email events recorded from Resend webhooks (sent/delivered/bounced). Optionally filter by recipient address. Empty until the Resend webhook is configured.',
    input_schema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Filter to this recipient email (optional)' },
        limit: { type: 'number', description: 'Max events, default 20' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'create_butcher_date',
    description:
      'WRITE — requires Grant’s approval. Creates a new butcher date (an animals row) that immediately goes on sale on the portal. Price per lb comes from the pricing matrix unless given explicitly.',
    input_schema: {
      type: 'object',
      properties: {
        butcher_date: { type: 'string', description: 'YYYY-MM-DD' },
        animal_type: { type: 'string', enum: ['grass_fed', 'grain_finished', 'wagyu'] },
        total_animals: { type: 'number', description: 'How many animals (1 = 1 whole = 2 halves = 4 quarters)' },
        price_per_lb: { type: 'number', description: 'Optional; defaults to the animal-type price already in use' },
        estimated_ready_date: { type: 'string', description: 'Optional YYYY-MM-DD; defaults to 3 weeks after butcher date' },
      },
      required: ['butcher_date', 'animal_type', 'total_animals'],
      additionalProperties: false,
    },
  },
  {
    name: 'adjust_capacity',
    description:
      'WRITE — requires Grant’s approval. Changes total_animals on an existing butcher date (e.g. +1 grass-fed, -1 grain-finished). Refuses any change that would drop capacity below what customers already hold.',
    input_schema: {
      type: 'object',
      properties: {
        butcher_date: { type: 'string', description: 'YYYY-MM-DD' },
        animal_type: { type: 'string', enum: ['grass_fed', 'grain_finished', 'wagyu'] },
        delta: { type: 'number', description: 'Change to total_animals, e.g. 1 or -1' },
      },
      required: ['butcher_date', 'animal_type', 'delta'],
      additionalProperties: false,
    },
  },
  {
    name: 'mark_deposit_received',
    description:
      'WRITE - approval required. Marks a cash/check deposit as received: records the payment, confirms the reservation, unlocks their cut sheet, and sends the confirmation email. Same as the Confirm Deposit button.',
    input_schema: {
      type: 'object',
      properties: {
        ...CUSTOMER_ARG,
        method: { type: 'string', enum: ['check', 'cash'] },
        check_number: { type: 'string', description: 'Check number if paying by check (optional)' },
      },
      required: ['customer', 'method'],
      additionalProperties: false,
    },
  },
  {
    name: 'record_payment',
    description:
      'WRITE - approval required. Records money received against a reservation (usually a balance payment). Use paid_in_full to settle whatever is outstanding.',
    input_schema: {
      type: 'object',
      properties: {
        ...CUSTOMER_ARG,
        amount: { type: 'number', description: 'Dollars. Omit when paid_in_full is true.' },
        method: { type: 'string', enum: ['cash', 'check', 'card'] },
        check_number: { type: 'string' },
        paid_in_full: { type: 'boolean', description: 'Settle the full outstanding amount' },
      },
      required: ['customer', 'method'],
      additionalProperties: false,
    },
  },
  {
    name: 'enter_hanging_weight',
    description:
      'WRITE - approval required. Enters the hanging weight for an order, computes the balance, and emails the customer their final numbers.',
    input_schema: {
      type: 'object',
      properties: {
        ...CUSTOMER_ARG,
        weight_lbs: { type: 'number', description: 'Hanging weight in pounds' },
      },
      required: ['customer', 'weight_lbs'],
      additionalProperties: false,
    },
  },
  {
    name: 'mark_beef_ready',
    description:
      'WRITE - approval required. Marks an order ready for pickup and sends the beef-ready email with the pickup link.',
    input_schema: {
      type: 'object',
      properties: { ...CUSTOMER_ARG },
      required: ['customer'],
      additionalProperties: false,
    },
  },
  {
    name: 'mark_picked_up',
    description: 'WRITE - approval required. Marks an order as picked up and complete.',
    input_schema: {
      type: 'object',
      properties: { ...CUSTOMER_ARG },
      required: ['customer'],
      additionalProperties: false,
    },
  },
  {
    name: 'mark_balance_paid',
    description:
      'WRITE - approval required. Settles the remaining balance as paid (cash/check/card taken outside the portal).',
    input_schema: {
      type: 'object',
      properties: {
        ...CUSTOMER_ARG,
        method: { type: 'string', enum: ['cash', 'check', 'card'] },
        check_number: { type: 'string' },
      },
      required: ['customer', 'method'],
      additionalProperties: false,
    },
  },
  {
    name: 'apply_discount',
    description: 'WRITE - approval required. Applies a dollar discount to an order, with a note.',
    input_schema: {
      type: 'object',
      properties: {
        ...CUSTOMER_ARG,
        amount: { type: 'number', description: 'Discount in dollars' },
        note: { type: 'string', description: 'Why (shows on the invoice line)' },
      },
      required: ['customer', 'amount'],
      additionalProperties: false,
    },
  },
  {
    name: 'move_reservation',
    description:
      'WRITE - approval required. Moves a reservation to a different butcher date/animal type. Capacity is claimed on the target and released on the source; refuses when the target is full.',
    input_schema: {
      type: 'object',
      properties: {
        ...CUSTOMER_ARG,
        new_butcher_date: { type: 'string', description: 'YYYY-MM-DD of the target date' },
        new_animal_type: { type: 'string', enum: ['grass_fed', 'grain_finished', 'wagyu'] },
      },
      required: ['customer', 'new_butcher_date', 'new_animal_type'],
      additionalProperties: false,
    },
  },
  {
    name: 'cancel_reservation',
    description:
      'WRITE - approval required. Cancels a reservation and releases its capacity. Serious and hard to undo - restate who and what before proposing it.',
    input_schema: {
      type: 'object',
      properties: { ...CUSTOMER_ARG },
      required: ['customer'],
      additionalProperties: false,
    },
  },
  {
    name: 'send_cut_sheet_invite',
    description:
      'WRITE - approval required. Emails the customer their cut sheet link (the time-to-build-your-cut-sheet email).',
    input_schema: {
      type: 'object',
      properties: { ...CUSTOMER_ARG },
      required: ['customer'],
      additionalProperties: false,
    },
  },
  {
    name: 'email_customer',
    description:
      'WRITE - approval required. Sends a one-off branded email from orders@ to a customer. Write the message in plain text; paragraphs separated by blank lines.',
    input_schema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string' },
        message: { type: 'string', description: 'Plain-text body' },
      },
      required: ['to', 'subject', 'message'],
      additionalProperties: false,
    },
  },
  {
    name: 'text_customer',
    description:
      'WRITE - approval required. Texts a customer from the ranch number. Keep it short and say who it is from.',
    input_schema: {
      type: 'object',
      properties: {
        phone: { type: 'string', description: 'Customer phone number' },
        message: { type: 'string' },
      },
      required: ['phone', 'message'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_customer_info',
    description:
      'WRITE - approval required. Edits a customer\'s contact info (name, email, phone, address). Only the fields given are changed; the result shows before and after.',
    input_schema: {
      type: 'object',
      properties: {
        ...CUSTOMER_ARG,
        name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        address: { type: 'string' },
        city: { type: 'string' },
        state: { type: 'string' },
        zip: { type: 'string' },
      },
      required: ['customer'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_coupons',
    description: 'Every coupon code with its type, value, expiration, and whether it was redeemed.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'create_coupon',
    description:
      'WRITE - approval required. Creates a coupon code customers can use at checkout. fixed_amount and percentage discount the deposit total; waive_deposit skips it; percent_off_balance discounts the final balance.',
    input_schema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'The code, e.g. WELCOME50 (stored uppercase)' },
        type: {
          type: 'string',
          enum: ['fixed_amount', 'percentage', 'waive_deposit', 'percent_off_balance'],
        },
        value: { type: 'number', description: 'Dollars for fixed_amount, percent for the % types; not needed for waive_deposit' },
        expires_at: { type: 'string', description: 'YYYY-MM-DD (optional, no expiration if omitted)' },
        single_use: { type: 'boolean', description: 'Default true — dies after one redemption' },
      },
      required: ['code', 'type'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_coupon',
    description:
      'WRITE - approval required. Deletes an unredeemed coupon code. A redeemed coupon is refused — it is part of an order\'s record.',
    input_schema: {
      type: 'object',
      properties: { code: { type: 'string' } },
      required: ['code'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_pickup_windows',
    description: 'Every pickup window with date, times, capacity, active flag, and how many appointments are booked into it.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'create_pickup_window',
    description:
      'WRITE - approval required. Creates a pickup window customers can book once their beef is ready.',
    input_schema: {
      type: 'object',
      properties: {
        label: { type: 'string', description: 'e.g. "Saturday Morning Pickup" (optional)' },
        pickup_date: { type: 'string', description: 'YYYY-MM-DD' },
        start_time: { type: 'string', description: '24h HH:MM' },
        end_time: { type: 'string', description: '24h HH:MM' },
        max_slots: { type: 'number', description: 'Optional cap on bookings' },
      },
      required: ['pickup_date', 'start_time', 'end_time'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_pickup_window',
    description:
      'WRITE - approval required. Changes a pickup window (label, date, times, capacity, or active on/off). Warns when customers are already booked into it.',
    input_schema: {
      type: 'object',
      properties: {
        pickup_date: { type: 'string', description: 'YYYY-MM-DD of the window as it is now' },
        which: { type: 'string', description: 'Label or start time, when that date has several windows' },
        new_label: { type: 'string' },
        new_date: { type: 'string', description: 'YYYY-MM-DD' },
        new_start_time: { type: 'string', description: '24h HH:MM' },
        new_end_time: { type: 'string', description: '24h HH:MM' },
        new_max_slots: { type: 'number' },
        active: { type: 'boolean', description: 'false hides it from customers without deleting it' },
      },
      required: ['pickup_date'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_pickup_window',
    description:
      'WRITE - approval required. Deletes a pickup window. Refused when appointments are booked into it — move or cancel them first, or deactivate instead.',
    input_schema: {
      type: 'object',
      properties: {
        pickup_date: { type: 'string', description: 'YYYY-MM-DD' },
        which: { type: 'string', description: 'Label or start time, when that date has several windows' },
      },
      required: ['pickup_date'],
      additionalProperties: false,
    },
  },
  {
    name: 'preview_pricing',
    description:
      'What-if pricing for a hanging weight, BEFORE committing it: total cost, deposit credit, discount, and balance due, using the same math as the real entry. Read-only — saves nothing, emails nothing. Use this whenever Grant wants to sanity-check numbers first.',
    input_schema: {
      type: 'object',
      properties: {
        ...CUSTOMER_ARG,
        weight_lbs: { type: 'number', description: 'Hypothetical hanging weight in pounds' },
      },
      required: ['customer', 'weight_lbs'],
      additionalProperties: false,
    },
  },
  {
    name: 'check_customer_emails',
    description:
      'Did a customer get their emails? Returns the app\'s send log and Resend delivery events (delivered/opened/bounced) for that customer.',
    input_schema: {
      type: 'object',
      properties: { ...CUSTOMER_ARG },
      required: ['customer'],
      additionalProperties: false,
    },
  },
  {
    name: 'record_animal_cost',
    description:
      'WRITE - approval required. Records what an animal cost — purchase (what the steer cost), feed, butcher/processing, or other — on the Financials tab\'s ledger for a specific butcher date.',
    input_schema: {
      type: 'object',
      properties: {
        butcher_date: { type: 'string', description: 'YYYY-MM-DD of the animal it belongs to' },
        animal_type: { type: 'string', enum: ['grass_fed', 'grain_finished', 'wagyu'] },
        cost_type: { type: 'string', enum: ['purchase', 'feed', 'butcher', 'other'] },
        amount: { type: 'number', description: 'Dollars' },
        description: { type: 'string', description: 'e.g. "Steer #14 from the Hendersons" (optional)' },
        date: { type: 'string', description: 'YYYY-MM-DD spent (optional, defaults to today)' },
      },
      required: ['butcher_date', 'animal_type', 'cost_type', 'amount'],
      additionalProperties: false,
    },
  },
  {
    name: 'finances_report',
    description:
      'The Financials tab as numbers: per animal — revenue collected (net of card surcharges), what is still owed, costs by type, and profit so far — plus business-wide totals.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'upcoming_pickups',
    description: 'Scheduled pickup appointments with who, when, and whether they still owe money.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'update_persona',
    description:
      'WRITE — requires Grant’s approval. Changes your own name and/or standing instructions (tone, priorities, recurring behaviors Grant wants). Use when Grant asks you to change how you behave or what you are called.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'New name for the assistant (optional)' },
        extra_prompt: {
          type: 'string',
          description: 'Full replacement standing instructions (optional). Include everything that should persist, not just the change.',
        },
      },
      additionalProperties: false,
    },
  },
];

// ─── Executors ──────────────────────────────────────────────────────────────

type Json = Record<string, unknown>;

async function statusReport(): Promise<Json> {
  const supabase = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: animals }, { data: sessions }] = await Promise.all([
    supabase
      .from('animals')
      .select('name, animal_type, butcher_date, total_animals, units_used, status')
      .neq('status', 'archived')
      .gte('butcher_date', today)
      .order('butcher_date'),
    supabase
      .from('sessions')
      .select(
        `id, status, purchase_type, intended_payment_method, cut_sheet_complete,
         deposit_amount, created_at, hanging_weight_lbs, price_per_lb, discount_amount,
         balance_due, balance_paid,
         customers(name, email, phone), animals(name, butcher_date),
         payments(id, type, status, amount_cents, surcharge_cents, paid_at, method)`
      )
      .not('status', 'in', '("cancelled","picked_up")')
      .order('created_at', { ascending: false }),
  ]);

  const reservations = (sessions || []).map((s: any) => {
    const money = summarizeReservation(s);
    const stage = getStageMeta({
      status: s.status,
      cut_sheet_complete: s.cut_sheet_complete,
      order_total_cents: money.orderTotalCents,
      banked_cents: money.bankedCents,
      outstanding_cents: money.outstandingCents,
      intended_payment_method: s.intended_payment_method,
    });
    const customer = Array.isArray(s.customers) ? s.customers[0] : s.customers;
    const animal = Array.isArray(s.animals) ? s.animals[0] : s.animals;
    const daysWaiting = Math.floor(
      (Date.now() - new Date(s.created_at).getTime()) / 86400000
    );
    return {
      customer: customer?.name,
      phone: customer?.phone,
      order: `${PURCHASE_LABEL[s.purchase_type] || s.purchase_type} — ${animal?.name || '?'}`,
      butcher_date: animal?.butcher_date,
      stage: stage.label,
      needs_action: stage.needsAction,
      payment_method: s.intended_payment_method,
      deposit_amount: Number(s.deposit_amount) || null,
      banked_dollars: money.bankedCents / 100,
      outstanding_dollars: money.outstandingCents / 100,
      cut_sheet_complete: s.cut_sheet_complete,
      days_since_reserved: daysWaiting,
    };
  });

  return {
    butcher_dates: (animals || []).map((a: any) => ({
      ...a,
      units_left: Number(a.total_animals) - Number(a.units_used),
    })),
    reservations,
    needs_attention: reservations.filter(
      (r) => r.needs_action || (r.banked_dollars === 0 && r.days_since_reserved >= 5)
    ),
  };
}

async function findReservation(input: { query: string }): Promise<Json> {
  const supabase = getSupabaseAdmin();
  const q = `%${input.query.trim()}%`;

  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, email, phone')
    .or(`name.ilike.${q},email.ilike.${q}`)
    .limit(5);

  if (!customers || customers.length === 0) {
    return { found: false, note: 'No customer matched that name or email.' };
  }

  const results = [];
  for (const c of customers) {
    const { data: sessions } = await supabase
      .from('sessions')
      .select(
        `id, status, purchase_type, intended_payment_method, cut_sheet_complete,
         cut_sheet_locked_at, deposit_amount, created_at, hanging_weight_lbs,
         price_per_lb, discount_amount, balance_paid,
         animals(name, butcher_date),
         payments(type, status, amount_cents, surcharge_cents, method, paid_at, check_number)`
      )
      .eq('customer_id', c.id)
      .order('created_at', { ascending: false });

    const { data: emails } = await supabase
      .from('email_events')
      .select('event_type, subject, created_at')
      .eq('to_email', c.email.toLowerCase())
      .order('created_at', { ascending: false })
      .limit(10);

    results.push({
      customer: c,
      orders: (sessions || []).map((s: any) => ({
        ...s,
        money: summarizeReservation(s),
      })),
      recent_emails: emails || [],
    });
  }
  return { found: true, matches: results };
}

async function capacity(): Promise<Json> {
  const supabase = getSupabaseAdmin();
  const { data: animals } = await supabase
    .from('animals')
    .select('name, animal_type, butcher_date, total_animals, units_used, status, price_per_lb')
    .neq('status', 'archived')
    .order('butcher_date');

  return {
    animals: (animals || []).map((a: any) => {
      const left = Number(a.total_animals) - Number(a.units_used);
      return {
        ...a,
        units_left: left,
        sellable_as: {
          wholes: Math.floor(left),
          halves: Math.floor(left / 0.5),
          quarters: Math.floor(left / 0.25),
        },
      };
    }),
  };
}

async function emailLog(input: { to?: string; limit?: number }): Promise<Json> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('email_events')
    .select('event_type, to_email, subject, created_at')
    .order('created_at', { ascending: false })
    .limit(Math.min(input.limit || 20, 100));
  if (input.to) query = query.eq('to_email', input.to.toLowerCase());

  const { data, error } = await query;
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return {
      events: [],
      note: 'No events recorded yet. The Resend webhook must be configured (RESEND_WEBHOOK_SECRET + endpoint in the Resend dashboard) before this fills in.',
    };
  }
  return { events: data };
}

async function createButcherDate(input: {
  butcher_date: string;
  animal_type: string;
  total_animals: number;
  price_per_lb?: number;
  estimated_ready_date?: string;
}): Promise<Json> {
  const supabase = getSupabaseAdmin();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.butcher_date)) {
    return { error: 'butcher_date must be YYYY-MM-DD' };
  }
  if (!(input.total_animals > 0) || input.total_animals > 20) {
    return { error: 'total_animals must be between 1 and 20' };
  }

  // Price defaults to what this animal type already sells for.
  let price = input.price_per_lb;
  if (!price) {
    const { data: recent } = await supabase
      .from('animals')
      .select('price_per_lb')
      .eq('animal_type', input.animal_type)
      .not('price_per_lb', 'is', null)
      .order('butcher_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    price = recent?.price_per_lb ? Number(recent.price_per_lb) : undefined;
  }

  const d = new Date(input.butcher_date + 'T00:00:00');
  const monthLabel = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const name = `${monthLabel} — ${TYPE_LABEL[input.animal_type] || input.animal_type}`;
  const ready =
    input.estimated_ready_date ||
    new Date(d.getTime() + 21 * 86400000).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('animals')
    .insert({
      name,
      animal_type: input.animal_type,
      butcher_date: input.butcher_date,
      estimated_ready_date: ready,
      total_animals: input.total_animals,
      units_used: 0,
      status: 'available',
      ...(price ? { price_per_lb: price } : {}),
    })
    .select('id, name, butcher_date, total_animals, price_per_lb')
    .single();

  if (error) return { error: error.message };
  return { created: data, note: 'Live on the portal immediately.' };
}

async function adjustCapacity(input: {
  butcher_date: string;
  animal_type: string;
  delta: number;
}): Promise<Json> {
  const supabase = getSupabaseAdmin();
  const { data: animal } = await supabase
    .from('animals')
    .select('id, name, total_animals, units_used')
    .eq('butcher_date', input.butcher_date)
    .eq('animal_type', input.animal_type)
    .neq('status', 'archived')
    .maybeSingle();

  if (!animal) return { error: 'No animal found for that date and type.' };

  const newTotal = Number(animal.total_animals) + input.delta;
  if (newTotal < Number(animal.units_used)) {
    return {
      error: `Refused: customers already hold ${animal.units_used} units; total cannot go below that.`,
    };
  }
  if (newTotal < 0 || newTotal > 20) return { error: 'Total must be between 0 and 20.' };

  const { error } = await supabase
    .from('animals')
    .update({ total_animals: newTotal })
    .eq('id', animal.id);

  if (error) return { error: error.message };
  return {
    updated: animal.name,
    total_animals: newTotal,
    units_left: newTotal - Number(animal.units_used),
  };
}

async function updatePersona(input: { name?: string; extra_prompt?: string }): Promise<Json> {
  const supabase = getSupabaseAdmin();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name && input.name.trim()) update.name = input.name.trim().slice(0, 40);
  if (typeof input.extra_prompt === 'string') update.extra_prompt = input.extra_prompt.slice(0, 4000);
  if (Object.keys(update).length === 1) return { error: 'Nothing to change.' };
  const { error } = await supabase.from('agent_config').update(update).eq('id', 1);
  if (error) return { error: error.message };
  return { updated: true, ...update };
}

/** Session-scoped write: resolve the customer, then run the admin route in-process. */
async function sessionWrite(
  customer: string,
  route: Parameters<typeof callSessionRoute>[0],
  body: Record<string, unknown> = {}
): Promise<Json> {
  const resolved = await resolveSession(customer, {
    includeDone: route === 'record-payment' || route === 'mark-balance-paid' || route === 'picked-up',
  });
  if (!resolved.sessionId) {
    return { error: resolved.error, candidates: resolved.candidates };
  }
  const result = await callSessionRoute(route, resolved.sessionId, body);
  return { customer: resolved.customer, ...result };
}

/** Runs a tool. The route checks WRITE_TOOLS + approval before calling this for writes. */
export async function executeTool(name: string, input: unknown): Promise<Json> {
  try {
    switch (name) {
      case 'status_report':
        return await statusReport();
      case 'find_reservation':
        return await findReservation(input as { query: string });
      case 'capacity':
        return await capacity();
      case 'email_log':
        return await emailLog((input as { to?: string; limit?: number }) || {});
      case 'create_butcher_date':
        return await createButcherDate(input as Parameters<typeof createButcherDate>[0]);
      case 'adjust_capacity':
        return await adjustCapacity(input as Parameters<typeof adjustCapacity>[0]);
      case 'update_persona':
        return await updatePersona(input as { name?: string; extra_prompt?: string });
      case 'mark_deposit_received': {
        const i = input as { customer: string; method: string; check_number?: string };
        return await sessionWrite(i.customer, 'confirm-deposit', {
          method: i.method,
          check_number: i.check_number,
        });
      }
      case 'record_payment': {
        const i = input as {
          customer: string; amount?: number; method: string; check_number?: string; paid_in_full?: boolean;
        };
        return await sessionWrite(i.customer, 'record-payment', {
          amount: i.amount,
          method: i.method,
          check_number: i.check_number,
          paid_in_full: i.paid_in_full === true,
        });
      }
      case 'enter_hanging_weight': {
        const i = input as { customer: string; weight_lbs: number };
        return await sessionWrite(i.customer, 'hanging-weight', { hanging_weight_lbs: i.weight_lbs });
      }
      case 'mark_beef_ready':
        return await sessionWrite((input as { customer: string }).customer, 'mark-ready');
      case 'mark_picked_up':
        return await sessionWrite((input as { customer: string }).customer, 'picked-up');
      case 'mark_balance_paid': {
        const i = input as { customer: string; method: string; check_number?: string };
        return await sessionWrite(i.customer, 'mark-balance-paid', {
          method: i.method,
          check_number: i.check_number,
        });
      }
      case 'apply_discount': {
        const i = input as { customer: string; amount: number; note?: string };
        return await sessionWrite(i.customer, 'discount', {
          discount_amount: i.amount,
          discount_note: i.note,
        });
      }
      case 'move_reservation': {
        const i = input as { customer: string; new_butcher_date: string; new_animal_type: string };
        const supabase = getSupabaseAdmin();
        const { data: target } = await supabase
          .from('animals')
          .select('id, name')
          .eq('butcher_date', i.new_butcher_date)
          .eq('animal_type', i.new_animal_type)
          .neq('status', 'archived')
          .maybeSingle();
        if (!target) return { error: 'No butcher date found for that date and type.' };
        const moved = await sessionWrite(i.customer, 'move', { new_animal_id: target.id });
        return { ...moved, moved_to: target.name };
      }
      case 'cancel_reservation':
        return await sessionWrite((input as { customer: string }).customer, 'cancel');
      case 'send_cut_sheet_invite':
        return await sessionWrite((input as { customer: string }).customer, 'send-cut-sheet-email');
      case 'email_customer':
        return await sendCustomerEmail(input as { to: string; subject: string; message: string });
      case 'text_customer':
        return await textCustomer(input as { phone: string; message: string });
      case 'update_customer_info':
        return await updateCustomerInfo(input as Parameters<typeof updateCustomerInfo>[0]);
      case 'list_coupons':
        return await listCoupons();
      case 'create_coupon':
        return await createCoupon(input as Parameters<typeof createCoupon>[0]);
      case 'delete_coupon':
        return await deleteCoupon(input as { code: string });
      case 'list_pickup_windows':
        return await listPickupWindows();
      case 'create_pickup_window':
        return await createPickupWindow(input as Parameters<typeof createPickupWindow>[0]);
      case 'update_pickup_window':
        return await updatePickupWindow(input as Parameters<typeof updatePickupWindow>[0]);
      case 'delete_pickup_window':
        return await deletePickupWindow(input as Parameters<typeof deletePickupWindow>[0]);
      case 'preview_pricing':
        return await previewPricing(input as { customer: string; weight_lbs: number });
      case 'check_customer_emails':
        return await checkCustomerEmails(input as { customer: string });
      case 'record_animal_cost':
        return await recordAnimalCost(input as Parameters<typeof recordAnimalCost>[0]);
      case 'finances_report':
        return await financesReport();
      case 'upcoming_pickups':
        return await upcomingPickups();
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Tool execution failed' };
  }
}

/** Audit trail for every approved write. */
export async function logAgentAction(tool: string, input: unknown, result: Json): Promise<void> {
  try {
    await getSupabaseAdmin().from('agent_actions').insert({ tool, input, result });
  } catch (err) {
    console.error('agent_actions log failed:', err);
  }
}

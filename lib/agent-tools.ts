import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { summarizeReservation } from '@/lib/reservation';
import { getStageMeta } from '@/lib/reservation-status';

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

export const WRITE_TOOLS = new Set(['create_butcher_date', 'adjust_capacity']);

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

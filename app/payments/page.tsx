'use client';

import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Chip } from '@/components/ui/Chip';
import { ActionSheet, SheetAction } from '@/components/ActionSheet';
import { openSquarePos } from '@/lib/square-pos';
import {
  formatCents,
  formatCurrency,
  formatDate,
  formatMonth,
  paymentMethodLabel,
  purchaseTypeShort,
} from '@/lib/format';

interface PaymentRecord {
  session_id: string;
  customer_name: string;
  customer_phone: string | null;
  animal_name: string;
  butcher_date: string | null;
  purchase_type: string;
  status: string;
  deposit_amount_cents: number | null;
  deposit_paid_at: string | null;
  deposit_method: string | null;
  balance_due: number;
  balance_paid: boolean;
  balance_paid_at: string | null;
  balance_payment_method: string | null;
  order_total_cents: number;
  banked_cents: number;
  outstanding_cents: number;
  payment_count: number;
  unrecorded_settlement: boolean;
}

interface Totals {
  deposits_cents: number;
  banked_cents: number;
  outstanding_cents: number;
  order_total_cents: number;
  outstanding_count: number;
  unrecorded_count: number;
}

type Filter = 'owed' | 'all' | 'settled';

const SQUARE_DASHBOARD = 'https://squareup.com/dashboard/sales/transactions';

export default function PaymentsPage() {
  const [records, setRecords] = useState<PaymentRecord[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('owed');
  const [query, setQuery] = useState('');
  const [sheet, setSheet] = useState<PaymentRecord | null>(null);
  const [posFallback, setPosFallback] = useState(false);
  const [method, setMethod] = useState('cash');
  const [checkNumber, setCheckNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const res = await fetch('/api/admin/payments');
      const data = await res.json();
      setRecords(data.records || []);
      setTotals(data.totals || null);
    } catch {
      // Leaves the empty state in place rather than showing wrong numbers.
    } finally {
      setLoading(false);
    }
  }

  function openSheet(r: PaymentRecord) {
    setSheet(r);
    setMethod('cash');
    setCheckNumber('');
    setAmount((r.outstanding_cents / 100).toFixed(2));
  }

  async function record(paidInFull: boolean) {
    if (!sheet) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/sessions/${sheet.session_id}/record-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method,
          check_number: checkNumber || null,
          ...(paidInFull ? { paid_in_full: true } : { amount: parseFloat(amount) }),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'Could not record that payment.');
        return;
      }
      setSheet(null);
      load();
    } catch (err) {
      alert(`Could not record that payment: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records
      .filter((r) => {
        if (filter === 'owed' && r.outstanding_cents <= 0) return false;
        if (filter === 'settled' && r.outstanding_cents > 0) return false;
        if (q && !r.customer_name.toLowerCase().includes(q) && !r.animal_name.toLowerCase().includes(q)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.outstanding_cents !== b.outstanding_cents) return b.outstanding_cents - a.outstanding_cents;
        return a.customer_name.localeCompare(b.customer_name);
      });
  }, [records, filter, query]);

  const counts = useMemo(
    () => ({
      owed: records.filter((r) => r.outstanding_cents > 0).length,
      all: records.length,
      settled: records.filter((r) => r.outstanding_cents <= 0).length,
    }),
    [records]
  );

  return (
    <AdminLayout title="Payments">
      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading payments…</p>
      ) : (
        <div className="max-w-4xl">
          {/* Money in, money out — two tiles that fit a phone. */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Tile
              label="Collected"
              value={formatCents(totals?.banked_cents ?? 0)}
              hint={`across ${records.length} order${records.length === 1 ? '' : 's'}`}
              accent="var(--success-fg)"
            />
            <Tile
              label="Still owed"
              value={formatCents(totals?.outstanding_cents ?? 0)}
              hint={`${totals?.outstanding_count ?? 0} order${totals?.outstanding_count === 1 ? '' : 's'}`}
              accent={(totals?.outstanding_cents ?? 0) > 0 ? 'var(--warning-fg)' : 'var(--text-muted)'}
            />
          </div>

          {(totals?.unrecorded_count ?? 0) > 0 && (
            <div
              className="rounded-xl p-3 mb-4 text-sm"
              style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', color: 'var(--warning-fg)' }}
            >
              <strong>{totals?.unrecorded_count} order(s) are marked paid with no payment on file.</strong>{' '}
              Revenue is under-reported until the payment is recorded. Open the order below and record it.
            </div>
          )}

          {/* Take a payment */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <button
              onClick={() => {
                const r = openSquarePos();
                // On desktop there is no app; on mobile, show help if nothing
                // grabbed the link within a beat.
                if (!r.attempted) setPosFallback(true);
                else setTimeout(() => setPosFallback((v) => v || !document.hidden), 1600);
              }}
              className="rounded-xl px-4 py-3 text-center text-sm font-semibold text-white bg-brand-orange hover:bg-brand-orange-hover"
            >
              Open Square POS
            </button>
            <a
              href={SQUARE_DASHBOARD}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl px-4 py-3 text-center text-sm font-semibold"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
            >
              Square dashboard
            </a>
          </div>

          {posFallback && (
            <div
              className="rounded-xl p-3 mb-4 text-sm"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', color: 'var(--text-muted, #9ca3af)' }}
            >
              Square POS didn&apos;t open. It only works on a phone or tablet with the{' '}
              <a className="underline" href="https://squareup.com/us/en/point-of-sale/app" target="_blank" rel="noopener noreferrer">
                Square POS app
              </a>{' '}
              installed — on this device, use the{' '}
              <a className="underline" href={SQUARE_DASHBOARD} target="_blank" rel="noopener noreferrer">
                Square dashboard
              </a>{' '}
              instead.
            </div>
          )}

          {/* Filters + search */}
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
            {(['owed', 'all', 'settled'] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold border whitespace-nowrap ${
                  filter === f ? 'bg-brand-orange text-white' : 'text-gray-300'
                }`}
                style={filter === f ? undefined : { background: 'var(--surface-1)', borderColor: 'var(--border)' }}
              >
                {f === 'owed' ? 'Owes money' : f === 'all' ? 'All' : 'Settled'} ({counts[f]})
              </button>
            ))}
          </div>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customer or butcher date"
            aria-label="Search payments"
            className="w-full mb-4 px-4 py-3 rounded-xl text-[16px] bg-transparent text-white border focus:outline-none focus:ring-2 focus:ring-brand-orange"
            style={{ borderColor: 'var(--border)' }}
          />

          {visible.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: 'var(--text-muted)' }}>
              {filter === 'owed' ? 'Nothing outstanding. Everyone is paid up.' : 'No orders match.'}
            </p>
          ) : (
            <div className="space-y-2">
              {visible.map((r) => (
                <PaymentRow key={r.session_id} record={r} onOpen={openSheet} />
              ))}
            </div>
          )}
        </div>
      )}

      <ActionSheet
        open={!!sheet}
        title={sheet?.customer_name ?? ''}
        subtitle={
          sheet
            ? `${purchaseTypeShort(sheet.purchase_type)} · ${formatCents(sheet.outstanding_cents)} outstanding`
            : undefined
        }
        onClose={() => setSheet(null)}
      >
        {sheet && (
          <>
            <div className="mb-4 rounded-xl p-3 text-sm" style={{ background: 'var(--surface-2)' }}>
              <Line label="Order total" value={formatCents(sheet.order_total_cents)} />
              <Line label="Collected" value={formatCents(sheet.banked_cents)} />
              <Line label="Outstanding" value={formatCents(sheet.outstanding_cents)} strong />
            </div>

            {sheet.outstanding_cents > 0 && (
              <button
                onClick={() => {
                  const r = openSquarePos(
                    sheet.outstanding_cents,
                    `${sheet.customer_name} — ${purchaseTypeShort(sheet.purchase_type)} balance`,
                    { sessionId: sheet.session_id, amountCents: sheet.outstanding_cents }
                  );
                  if (!r.attempted) setPosFallback(true);
                }}
                className="w-full mb-4 py-3 rounded-xl text-sm font-semibold text-white bg-brand-orange hover:bg-brand-orange-hover"
              >
                Charge {formatCents(sheet.outstanding_cents)} in Square POS
              </button>
            )}

            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>
              Paid by
            </p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { v: 'cash', l: 'Cash' },
                { v: 'check', l: 'Check' },
                { v: 'card', l: 'Card' },
              ].map((m) => (
                <button
                  key={m.v}
                  onClick={() => setMethod(m.v)}
                  className={`py-2.5 rounded-lg text-sm font-semibold border ${method === m.v ? 'text-white' : 'text-gray-300'}`}
                  style={{
                    background: method === m.v ? 'var(--accent-soft)' : 'transparent',
                    borderColor: method === m.v ? 'var(--accent)' : 'var(--border)',
                  }}
                >
                  {m.l}
                </button>
              ))}
            </div>

            {method === 'check' && (
              <input
                value={checkNumber}
                onChange={(e) => setCheckNumber(e.target.value)}
                placeholder="Check number (optional)"
                aria-label="Check number"
                className="w-full mb-3 px-4 py-3 rounded-xl text-[16px] bg-transparent text-white border focus:outline-none focus:ring-2 focus:ring-brand-orange"
                style={{ borderColor: 'var(--border)' }}
              />
            )}

            {sheet.outstanding_cents > 0 && (
              <SheetAction intent="primary" disabled={saving} onClick={() => record(true)}>
                {saving ? 'Recording…' : `Paid in full — ${formatCents(sheet.outstanding_cents)}`}
              </SheetAction>
            )}

            <p className="text-xs font-semibold uppercase tracking-wider mt-4 mb-2" style={{ color: 'var(--text-secondary)' }}>
              Or a partial amount
            </p>
            <div className="flex gap-2 mb-2">
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-label="Amount received"
                className="flex-1 px-4 py-3 rounded-xl text-[16px] bg-transparent text-white border focus:outline-none focus:ring-2 focus:ring-brand-orange"
                style={{ borderColor: 'var(--border)' }}
              />
              <button
                onClick={() => record(false)}
                disabled={saving || !amount}
                className="px-5 rounded-xl text-sm font-semibold disabled:opacity-50"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
              >
                Record
              </button>
            </div>

            <SheetAction intent="quiet" onClick={() => setSheet(null)}>
              Close
            </SheetAction>
          </>
        )}
      </ActionSheet>
    </AdminLayout>
  );
}

function Tile({ label, value, hint, accent }: { label: string; value: string; hint: string; accent: string }) {
  return (
    <div
      className="rounded-xl p-4 border-t-[3px]"
      style={{ background: 'var(--surface-1)', borderTopColor: accent, border: '1px solid var(--border)', borderTopWidth: 3, borderTopStyle: 'solid' }}
    >
      <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      <p className="text-2xl font-bold text-white leading-tight break-words tabular-nums">{value}</p>
      <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>{hint}</p>
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between py-0.5">
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="tabular-nums" style={{ color: strong ? 'var(--text)' : 'var(--text-secondary)', fontWeight: strong ? 700 : 400 }}>
        {value}
      </span>
    </div>
  );
}

function PaymentRow({ record, onOpen }: { record: PaymentRecord; onOpen: (r: PaymentRecord) => void }) {
  const owes = record.outstanding_cents > 0;

  return (
    <button
      type="button"
      onClick={() => onOpen(record)}
      className="relative w-full text-left rounded-xl p-4 pl-5 overflow-hidden"
      style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
    >
      <span
        aria-hidden="true"
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ background: owes ? 'var(--warning-fg)' : 'var(--success-fg)' }}
      />

      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block font-semibold text-[15px] text-white truncate">{record.customer_name}</span>
          <span className="block text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {purchaseTypeShort(record.purchase_type)} · {formatMonth(record.butcher_date)}
          </span>
        </span>
        <span className="text-right shrink-0">
          <span className="block text-[15px] font-bold tabular-nums" style={{ color: owes ? 'var(--warning-fg)' : 'var(--success-fg)' }}>
            {owes ? formatCents(record.outstanding_cents) : formatCents(record.banked_cents)}
          </span>
          <span className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {owes ? 'outstanding' : 'collected'}
          </span>
        </span>
      </span>

      <span className="flex items-center gap-1.5 mt-2.5 flex-wrap">
        {record.deposit_amount_cents ? (
          <Chip tone="success" size="sm">
            Deposit {formatCents(record.deposit_amount_cents)} · {paymentMethodLabel(record.deposit_method)}
          </Chip>
        ) : (
          <Chip tone="danger" size="sm">No deposit</Chip>
        )}
        {record.balance_paid && <Chip tone="success" size="sm">Balance paid</Chip>}
        {record.unrecorded_settlement && <Chip tone="warning" size="sm">Payment not recorded</Chip>}
        {record.status === 'picked_up' && <Chip tone="neutral" size="sm">Picked up</Chip>}
      </span>

      {record.order_total_cents > 0 && (
        <span className="block text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
          Order {formatCurrency(record.order_total_cents / 100)}
          {record.deposit_paid_at ? ` · deposit ${formatDate(record.deposit_paid_at)}` : ''}
        </span>
      )}
    </button>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import { PageHeader, Panel, StatCard } from '@/components/ui';
import { formatCents } from '@/lib/format';

interface DashboardData {
  upcoming_dates: number;
  open_capacity: number;
  active_reservations: number;
  revenue_collected_cents: number;
  outstanding_cents: number;
  awaiting_deposit: number;
  pending_cut_sheets: number;
  awaiting_hanging_weight: number;
  balance_due: number;
  ready_for_pickup: number;
  picked_up: number;
  unrecorded_settlements: number;
  past_dates_needing_attention: number;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const res = await fetch('/api/admin/dashboard');
        const json = await res.json();
        if (!json.error) setData(json);
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  const v = (n: number | undefined) => (loading ? '…' : (n ?? 0));

  // Only the things that need doing today, so an empty list means a clear day.
  const actions = [
    { key: 'awaiting_deposit', label: 'Awaiting deposit', count: data?.awaiting_deposit ?? 0, href: '/slots' },
    { key: 'pending_cut_sheets', label: 'Cut sheets open', count: data?.pending_cut_sheets ?? 0, href: '/cut-sheets' },
    { key: 'awaiting_hanging_weight', label: 'Needs hanging weight', count: data?.awaiting_hanging_weight ?? 0, href: '/slots' },
    { key: 'balance_due', label: 'Balance due', count: data?.balance_due ?? 0, href: '/payments' },
    { key: 'ready_for_pickup', label: 'Ready for pickup', count: data?.ready_for_pickup ?? 0, href: '/slots' },
  ].filter((a) => a.count > 0);

  return (
    <AdminLayout title="Dashboard">
      <PageHeader title="Dashboard" subtitle="Operational snapshot for the ranch" />

      <div className="space-y-5 max-w-4xl">
        {!loading && (data?.past_dates_needing_attention ?? 0) > 0 && (
          <Link
            href="/animals"
            className="block rounded-xl p-3 text-sm"
            style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', color: 'var(--warning-fg)' }}
          >
            {data?.past_dates_needing_attention} past butcher date
            {data?.past_dates_needing_attention === 1 ? '' : 's'} still {data?.past_dates_needing_attention === 1 ? 'has' : 'have'} loose ends — open Butcher Dates
          </Link>
        )}

        {!loading && (data?.unrecorded_settlements ?? 0) > 0 && (
          <Link
            href="/payments"
            className="block rounded-xl p-3 text-sm"
            style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', color: 'var(--warning-fg)' }}
          >
            {data?.unrecorded_settlements} order
            {data?.unrecorded_settlements === 1 ? ' is' : 's are'} marked paid with no payment on file — revenue is under-reported
          </Link>
        )}

        <Panel surface="1" padding="md">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Collected" value={loading ? '…' : formatCents(data?.revenue_collected_cents ?? 0)} />
            <StatCard label="Still owed" value={loading ? '…' : formatCents(data?.outstanding_cents ?? 0)} />
            <StatCard label="Active reservations" value={v(data?.active_reservations)} />
            <StatCard label="Open capacity (units)" value={v(data?.open_capacity)} />
          </div>
        </Panel>

        <Panel surface="1" padding="md">
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
            Needs you
          </h2>
          {loading ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</p>
          ) : actions.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Nothing waiting on you right now.
            </p>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              {actions.map((a) => (
                <Link
                  key={a.key}
                  href={a.href}
                  className="rounded-xl px-4 py-3 flex items-center justify-between gap-3"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                >
                  <span className="text-sm" style={{ color: 'var(--text)' }}>{a.label}</span>
                  <span className="text-lg font-bold tabular-nums" style={{ color: 'var(--accent)' }}>{a.count}</span>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <Panel surface="1" padding="md">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Upcoming butcher dates" value={v(data?.upcoming_dates)} />
            <StatCard label="Picked up" value={v(data?.picked_up)} />
          </div>
          {!loading && (data?.upcoming_dates ?? 0) === 0 && (
            <p className="text-sm mt-3" style={{ color: 'var(--warning-fg)' }}>
              No upcoming butcher dates — customers cannot reserve anything.{' '}
              <Link href="/animals" className="underline">Add a date</Link>
            </p>
          )}
        </Panel>
      </div>
    </AdminLayout>
  );
}

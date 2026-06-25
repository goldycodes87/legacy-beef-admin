'use client';

import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Panel, PanelSection } from '@/components/ui/Panel';
import { Chip } from '@/components/ui/Chip';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';

type CostType = 'purchase' | 'feed' | 'butcher' | 'other';

interface AnimalCost {
  id: string;
  type: CostType;
  description?: string | null;
  amount: number;
  date?: string | null;
}

interface Animal {
  id: string;
  name: string;
  butcher_date?: string | null;
  animal_type?: string | null;
  home_raised?: boolean | null;
  animal_costs?: AnimalCost[];
}

interface Customer {
  id: string;
  name?: string | null;
  email?: string | null;
}

interface Payment {
  amount_cents: number;
  type: string;
  status: string;
  method?: string | null;
}

interface Session {
  id: string;
  animal_id: string;
  purchase_type: 'whole' | 'half' | 'quarter';
  is_splitting?: boolean | null;
  group_size?: number | null;
  hanging_weight_lbs?: number | null;
  price_per_lb?: number | null;
  balance_due?: number | null;
  status: string;
  customers?: Customer[] | Customer | null;
  payments?: Payment[] | null;
}

interface FinancialsResponse {
  animals: Animal[];
  sessions: Session[];
}

const COST_COLORS: Record<CostType, { bg: string; border: string; color: string }> = {
  purchase: { bg: '#1e3a8a33', border: '#3b82f6', color: '#93c5fd' },
  feed: { bg: '#92400e33', border: '#fbbf24', color: '#fcd34d' },
  butcher: { bg: '#9a341233', border: '#fb923c', color: '#fdba74' },
  other: { bg: '#6b728033', border: '#9ca3af', color: '#d1d5db' },
};

const formatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCurrency(value: number) {
  return formatter.format(value);
}

function getUnitCost(purchaseType: Session['purchase_type']) {
  if (purchaseType === 'whole') return 1;
  if (purchaseType === 'half') return 0.5;
  return 0.25;
}

function getCustomer(session: Session): Customer | null {
  if (!session.customers) return null;
  if (Array.isArray(session.customers)) return session.customers[0] || null;
  return session.customers;
}

function sumPaidPayments(payments: Payment[] | null | undefined) {
  if (!payments) return 0;
  return payments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + (p.amount_cents || 0), 0) / 100;
}

function sumPaidByType(payments: Payment[] | null | undefined, type: string) {
  if (!payments) return 0;
  return payments
    .filter((p) => p.status === 'paid' && p.type === type)
    .reduce((sum, p) => sum + (p.amount_cents || 0), 0) / 100;
}

export default function FinancialsPage() {
  const [data, setData] = useState<FinancialsResponse>({ animals: [], sessions: [] });
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [costForms, setCostForms] = useState<Record<string, { type: CostType; description: string; amount: string; date: string }>>({});
  const [savingCostId, setSavingCostId] = useState<string | null>(null);
  const [deletingCostId, setDeletingCostId] = useState<string | null>(null);
  const [togglingHome, setTogglingHome] = useState<string | null>(null);

  const refreshData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/financials', { cache: 'no-store' });
      const json = await res.json();
      setData({
        animals: Array.isArray(json.animals) ? json.animals : [],
        sessions: Array.isArray(json.sessions) ? json.sessions : [],
      });
    } catch (err) {
      console.error('Failed to load financials', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleToggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddCost = async (animalId: string) => {
    const form = costForms[animalId];
    if (!form || !form.type || !form.amount) return;
    setSavingCostId(animalId);
    try {
      await fetch('/api/admin/financials/costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          animal_id: animalId,
          type: form.type,
          description: form.description || null,
          amount: Number(form.amount),
          date: form.date || undefined,
        }),
      });
      setCostForms((prev) => ({
        ...prev,
        [animalId]: {
          type: form.type,
          description: '',
          amount: '',
          date: form.date,
        },
      }));
      refreshData();
    } catch (err) {
      console.error('Failed to add cost', err);
    } finally {
      setSavingCostId(null);
    }
  };

  const handleDeleteCost = async (costId: string) => {
    setDeletingCostId(costId);
    try {
      await fetch(`/api/admin/financials/costs/${costId}`, { method: 'DELETE' });
      refreshData();
    } catch (err) {
      console.error('Failed to delete cost', err);
    } finally {
      setDeletingCostId(null);
    }
  };

  const handleHomeRaised = async (animalId: string, value: boolean) => {
    setTogglingHome(animalId);
    try {
      await fetch(`/api/admin/animals/${animalId}/home-raised`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ home_raised: value }),
      });
      refreshData();
    } catch (err) {
      console.error('Failed to update home raised', err);
    } finally {
      setTogglingHome(null);
    }
  };

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  useEffect(() => {
    const formState: Record<string, { type: CostType; description: string; amount: string; date: string }> = {};
    data.animals.forEach((animal) => {
      formState[animal.id] = formState[animal.id] || {
        type: 'other',
        description: '',
        amount: '',
        date: today,
      };
    });
    setCostForms((prev) => ({ ...formState, ...prev }));
  }, [data.animals, today]);

  const totals = useMemo(() => {
    let totalRevenue = 0;
    let totalCosts = 0;
    data.animals.forEach((animal) => {
      const animalCosts = (animal.animal_costs || []).reduce((sum, c) => sum + Number(c.amount || 0), 0);
      totalCosts += animalCosts;
      const sessions = data.sessions.filter((s) => s.animal_id === animal.id);
      totalRevenue += sessions.reduce((sum, s) => sum + sumPaidPayments(s.payments), 0);
    });
    return { totalRevenue, totalCosts, net: totalRevenue - totalCosts };
  }, [data]);

  if (loading) {
    return (
      <AdminLayout title="Financials">
        <div className="p-8 text-center text-[color:var(--text-muted)]">Loading financials…</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Financials">
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Panel padding="md" title="Total Revenue" emphasis>
            <div className="text-2xl font-semibold" style={{ color: 'var(--success-fg)' }}>
              {formatCurrency(totals.totalRevenue)}
            </div>
            <p className="type-helper mt-1">All paid payments</p>
          </Panel>
          <Panel padding="md" title="Total Costs" emphasis>
            <div className="text-2xl font-semibold" style={{ color: 'var(--danger-fg)' }}>
              {formatCurrency(totals.totalCosts)}
            </div>
            <p className="type-helper mt-1">Animal expenses recorded</p>
          </Panel>
          <Panel padding="md" title="Net P&L" emphasis>
            <div
              className="text-2xl font-semibold"
              style={{ color: totals.net >= 0 ? 'var(--success-fg)' : 'var(--danger-fg)' }}
            >
              {formatCurrency(totals.net)}
            </div>
            <p className="type-helper mt-1">Across all animals</p>
          </Panel>
        </div>

        <div className="space-y-4">
          {data.animals.map((animal) => {
            const animalSessions = data.sessions.filter((s) => s.animal_id === animal.id);
            const totalCosts = (animal.animal_costs || []).reduce((sum, c) => sum + Number(c.amount || 0), 0);
            const totalUnits = animalSessions.reduce((sum, session) => sum + getUnitCost(session.purchase_type), 0);
            const totalRevenue = animalSessions.reduce((sum, session) => sum + sumPaidPayments(session.payments), 0);
            const net = totalRevenue - totalCosts;
            const costSharePerUnit = totalUnits > 0 ? totalCosts / totalUnits : 0;
            const pnlPerHalf = totalUnits > 0 ? net / (totalUnits * 2) : net;
            const isExpanded = expanded.has(animal.id);
            const homeRaised = !!animal.home_raised;

            return (
              <Panel
                key={animal.id}
                padding="none"
                className="overflow-hidden"
              >
                <button
                  onClick={() => handleToggle(animal.id)}
                  className="w-full flex flex-col gap-3 p-4 sm:p-5 text-left hover:bg-[color:var(--surface-2)] transition-colors"
                  style={{ borderBottom: isExpanded ? '1px solid var(--border-subtle)' : undefined }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xl" aria-hidden>🐄</span>
                        <h3 className="text-lg font-semibold text-[color:var(--text)]">
                          {animal.name || 'Unnamed'}
                        </h3>
                        {homeRaised && <Chip tone="gold" size="sm">Home Raised 🏠</Chip>}
                      </div>
                      <div className="type-helper text-[color:var(--text-muted)] flex items-center gap-3 flex-wrap">
                        <span className="capitalize">{animal.animal_type || 'Animal'}</span>
                        {animal.butcher_date && (
                          <span>Butcher: {new Date(animal.butcher_date).toLocaleDateString()}</span>
                        )}
                        <span>Units: {totalUnits || 0}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Chip tone="success" icon="💵">{formatCurrency(totalRevenue)}</Chip>
                      <Chip tone="danger" icon="🧾">{formatCurrency(totalCosts)}</Chip>
                      <Chip
                        tone={net >= 0 ? 'success' : 'danger'}
                        icon={net >= 0 ? '📈' : '📉'}
                      >
                        {formatCurrency(net)}
                      </Chip>
                      <Chip tone="neutral" icon="➗">
                        P&L / Half: {formatCurrency(pnlPerHalf)}
                      </Chip>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="p-4 sm:p-6 space-y-6">
                    <PanelSection label="Costs">
                      <div className="flex items-center flex-wrap gap-3 mb-3">
                        <label className="flex items-center gap-2 text-sm text-[color:var(--text)]">
                          <input
                            type="checkbox"
                            checked={homeRaised}
                            onChange={(e) => handleHomeRaised(animal.id, e.target.checked)}
                            disabled={togglingHome === animal.id}
                            className="accent-[color:var(--accent)]"
                          />
                          Home Raised
                        </label>
                        {!homeRaised && (
                          <span className="type-helper text-[color:var(--text-muted)]">
                            Track purchase cost via a cost entry
                          </span>
                        )}
                      </div>

                      <div className="space-y-3">
                        {(animal.animal_costs || [])
                          .filter((c) => !homeRaised || c.type !== 'purchase')
                          .sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime())
                          .map((cost) => (
                            <div
                              key={cost.id}
                              className="flex items-center justify-between rounded-md px-3 py-2"
                              style={{
                                background: COST_COLORS[cost.type].bg,
                                border: `1px solid ${COST_COLORS[cost.type].border}`,
                              }}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                <Chip size="sm" style={{ background: COST_COLORS[cost.type].bg, color: COST_COLORS[cost.type].color, border: `1px solid ${COST_COLORS[cost.type].border}` }}>
                                  {cost.type}
                                </Chip>
                                <span className="text-[color:var(--text)]">
                                  {cost.description || 'No description'}
                                </span>
                                <span className="text-[color:var(--text-muted)] text-sm">
                                  {cost.date ? new Date(cost.date).toLocaleDateString() : ''}
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-semibold text-[color:var(--text)]">
                                  {formatCurrency(Number(cost.amount || 0))}
                                </span>
                                <button
                                  onClick={() => handleDeleteCost(cost.id)}
                                  className="text-[color:var(--danger-fg)] text-sm font-semibold hover:underline"
                                  disabled={deletingCostId === cost.id}
                                >
                                  {deletingCostId === cost.id ? 'Removing…' : 'Delete'}
                                </button>
                              </div>
                            </div>
                          ))}

                        <div
                          className="rounded-md p-3 border"
                          style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
                        >
                          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                            <div className="md:col-span-1">
                              <label className="type-helper block mb-1">Type</label>
                              <select
                                value={costForms[animal.id]?.type || 'other'}
                                onChange={(e) =>
                                  setCostForms((prev) => ({
                                    ...prev,
                                    [animal.id]: { ...prev[animal.id], type: e.target.value as CostType },
                                  }))
                                }
                                className="w-full bg-[color:var(--surface-1)] border border-[color:var(--border)] rounded-md px-3 py-2 text-sm"
                              >
                                {!homeRaised && <option value="purchase">Purchase</option>}
                                <option value="feed">Feed</option>
                                <option value="butcher">Butcher</option>
                                <option value="other">Other</option>
                              </select>
                            </div>
                            <div className="md:col-span-2">
                              <label className="type-helper block mb-1">Description</label>
                              <input
                                type="text"
                                value={costForms[animal.id]?.description || ''}
                                onChange={(e) =>
                                  setCostForms((prev) => ({
                                    ...prev,
                                    [animal.id]: { ...prev[animal.id], description: e.target.value },
                                  }))
                                }
                                placeholder="Feed, processing, transport…"
                                className="w-full bg-[color:var(--surface-1)] border border-[color:var(--border)] rounded-md px-3 py-2 text-sm text-[color:var(--text)]"
                              />
                            </div>
                            <div>
                              <label className="type-helper block mb-1">Amount</label>
                              <input
                                type="number"
                                step="0.01"
                                value={costForms[animal.id]?.amount || ''}
                                onChange={(e) =>
                                  setCostForms((prev) => ({
                                    ...prev,
                                    [animal.id]: { ...prev[animal.id], amount: e.target.value },
                                  }))
                                }
                                className="w-full bg-[color:var(--surface-1)] border border-[color:var(--border)] rounded-md px-3 py-2 text-sm text-[color:var(--text)]"
                              />
                            </div>
                            <div>
                              <label className="type-helper block mb-1">Date</label>
                              <input
                                type="date"
                                value={costForms[animal.id]?.date || today}
                                onChange={(e) =>
                                  setCostForms((prev) => ({
                                    ...prev,
                                    [animal.id]: { ...prev[animal.id], date: e.target.value },
                                  }))
                                }
                                className="w-full bg-[color:var(--surface-1)] border border-[color:var(--border)] rounded-md px-3 py-2 text-sm text-[color:var(--text)]"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end mt-3">
                            <button
                              onClick={() => handleAddCost(animal.id)}
                              className="px-4 py-2 rounded-md font-semibold text-sm text-white"
                              style={{ background: 'var(--accent)' }}
                              disabled={savingCostId === animal.id}
                            >
                              {savingCostId === animal.id ? 'Adding…' : 'Add Cost'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </PanelSection>

                    <PanelSection label="Revenue & Customers">
                      <Table>
                        <THead>
                          <TR>
                            <TH>Customer</TH>
                            <TH>Order</TH>
                            <TH align="right">Deposits Paid</TH>
                            <TH align="right">Balance Paid</TH>
                            <TH align="right">Total Paid</TH>
                            <TH align="right">Their Cost Share</TH>
                            <TH align="right">Their P&L</TH>
                          </TR>
                        </THead>
                        <TBody>
                          {animalSessions.map((session) => {
                            const customer = getCustomer(session);
                            const unitCost = getUnitCost(session.purchase_type);
                            const depositPaid = sumPaidByType(session.payments, 'deposit');
                            const balancePaid = sumPaidByType(session.payments, 'balance');
                            const totalPaid = depositPaid + balancePaid + sumPaidByType(session.payments, 'other');
                            const costShare = costSharePerUnit * unitCost;
                            const pnl = totalPaid - costShare;
                            const orderLabel = session.purchase_type === 'whole'
                              ? 'Whole Beef'
                              : session.purchase_type === 'half'
                                ? 'Half Beef'
                                : 'Quarter Beef';

                            return (
                              <TR key={session.id}>
                                <TD>
                                  <div className="flex flex-col">
                                    <span>{customer?.name || 'Unknown'}</span>
                                    <span className="type-helper text-[color:var(--text-muted)]">{customer?.email}</span>
                                  </div>
                                </TD>
                                <TD>
                                  <div className="flex items-center gap-2">
                                    <Chip tone="accent" size="sm">{orderLabel}</Chip>
                                    {session.is_splitting && session.group_size && (
                                      <Chip tone="neutral" size="sm">Split {session.group_size}×</Chip>
                                    )}
                                  </div>
                                </TD>
                                <TD align="right">{formatCurrency(depositPaid)}</TD>
                                <TD align="right">{formatCurrency(balancePaid)}</TD>
                                <TD align="right" className="font-semibold">{formatCurrency(totalPaid)}</TD>
                                <TD align="right">{formatCurrency(costShare)}</TD>
                                <TD align="right">
                                  <span style={{ color: pnl >= 0 ? 'var(--success-fg)' : 'var(--danger-fg)' }}>
                                    {formatCurrency(pnl)}
                                  </span>
                                </TD>
                              </TR>
                            );
                          })}
                          <TR>
                            <TD colSpan={2} className="font-semibold">Totals</TD>
                            <TD align="right" className="font-semibold text-[color:var(--success-fg)]">
                              {formatCurrency(animalSessions.reduce((sum, s) => sum + sumPaidByType(s.payments, 'deposit'), 0))}
                            </TD>
                            <TD align="right" className="font-semibold text-[color:var(--success-fg)]">
                              {formatCurrency(animalSessions.reduce((sum, s) => sum + sumPaidByType(s.payments, 'balance'), 0))}
                            </TD>
                            <TD align="right" className="font-semibold">
                              {formatCurrency(totalRevenue)}
                            </TD>
                            <TD align="right" className="font-semibold text-[color:var(--danger-fg)]">
                              {formatCurrency(totalCosts)}
                            </TD>
                            <TD align="right" className="font-semibold">
                              <span style={{ color: net >= 0 ? 'var(--success-fg)' : 'var(--danger-fg)' }}>
                                {formatCurrency(net)}
                              </span>
                            </TD>
                          </TR>
                        </TBody>
                      </Table>
                    </PanelSection>
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
      </div>
    </AdminLayout>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { PaymentForm, CreditCard } from 'react-square-web-payments-sdk';
import AdminLayout from '@/components/AdminLayout';

function ConfirmModal({ message, onConfirm, onCancel }: { message: string, onConfirm: () => void, onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className="rounded-2xl p-6 w-full max-w-sm shadow-xl"
        style={{ background: 'var(--surface-1)' }}
      >
        <p className="text-white font-semibold mb-6 text-center">{message}</p>
        <div className="flex gap-3">
          <button onClick={onConfirm} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg font-semibold">
            Yes, Delete
          </button>
          <button
            onClick={onCancel}
            className="flex-1 text-white py-2 rounded-lg font-semibold"
            style={{ background: 'var(--surface-2)' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

interface Reservation {
  id: string;
  customer_name: string;
  purchase_type: string;
  status: string;
  deposit_paid: boolean;
  cut_sheet_complete: boolean;
  created_at: string;
  animal_id?: string;
  price_per_lb?: number;
  deposit_amount_cents?: number;
  admin_notes?: string | null;
  hanging_weight_lbs?: number | null;
  balance_paid?: boolean;
  balance_due?: number;
  balance_payment_method?: string;
  payment_method?: string;
  intended_payment_method?: string | null;
  check_number?: string | null;
  animals?: { price_per_lb?: number };
}

interface AnimalGroup {
  animal: { name: string; butcher_date: string };
  sessions: Reservation[];
}

export default function SlotsPage() {
  const [slots, setSlots] = useState<Record<string, AnimalGroup>>({});
  const [loading, setLoading] = useState(true);
  const [moveModal, setMoveModal] = useState<{open: boolean, session: Reservation | null}>({open: false, session: null});
  const [availableAnimals, setAvailableAnimals] = useState<{id: string, name: string, butcher_date: string}[]>([]);
  const [selectedAnimalId, setSelectedAnimalId] = useState('');
  const [confirmModal, setConfirmModal] = useState<{open: boolean, message: string, onConfirm: () => void}>({open: false, message: '', onConfirm: () => {}});
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [manualChargeSession, setManualChargeSession] = useState<Reservation | null>(null);
  const [hangingWeights, setHangingWeights] = useState<Record<string, string>>({});
  const [savingWeight, setSavingWeight] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [depositModal, setDepositModal] = useState<{ open: boolean; sessionId: string; customerName: string; } | null>(null);
  const [depositForm, setDepositForm] = useState<{ method: string; checkNumber: string; }>({ method: 'check', checkNumber: '' });
  const [discountForm, setDiscountForm] = useState<Record<string, { type: string; value: string; note: string }>>({});

  const handleSaveAdminNotes = async (sessionId: string, notes: string) => {
    await fetch(`/api/admin/sessions/${sessionId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_notes: notes }),
    });
  };

  const handleMarkBalancePaid = async (sessionId: string) => {
    const method = window.prompt('Payment method? Type: cash, check, or card', 'check');
    if (!method) return;
    if (!confirm(`Mark balance as paid by ${method}?`)) return;
    try {
      const res = await fetch(
        `/api/admin/sessions/${sessionId}/mark-balance-paid`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } }
      );
      if (res.ok) loadSlots();
      else alert('Failed to mark balance paid');
    } catch (err) {
      alert('Error: ' + err);
    }
  };

  useEffect(() => {
    loadSlots();
  }, []);

  const loadSlots = async () => {
    try {
      const res = await fetch('/api/admin/slots');
      const data = await res.json();
      setSlots(data);
    } catch (err) {
      console.error('Failed to load slots:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMoveOpen = async (session: Reservation) => {
    const res = await fetch('/api/admin/animals');
    const animals = await res.json();
    // Filter to same purchase type availability
    setAvailableAnimals(animals.filter((a: any) => a.id !== session.animal_id && (a.total_animals - a.units_used) > 0));
    setMoveModal({ open: true, session });
  };

  const handleMove = async () => {
    if (!moveModal.session || !selectedAnimalId) return;
    try {
      await fetch(`/api/admin/sessions/${moveModal.session.id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_animal_id: selectedAnimalId }),
      });
      setMoveModal({ open: false, session: null });
      loadSlots();
    } catch (err) {
      console.error('Move error:', err);
    }
  };

  const handleCancel = async (session: Reservation) => {
    const cancelMessage = `Cancel reservation for ${session.customer_name}? If a deposit was paid, it will need to be refunded manually through Square.`;
    setConfirmModal({
      open: true,
      message: cancelMessage,
      onConfirm: async () => {
        try {
          await fetch(`/api/admin/sessions/${session.id}/cancel`, { method: 'POST' });
          setConfirmModal({ open: false, message: '', onConfirm: () => {} });
          loadSlots();
        } catch (err) {
          console.error('Cancel error:', err);
          setConfirmModal({ open: false, message: '', onConfirm: () => {} });
        }
      }
    });
  };

  const handlePickedUp = async (sessionId: string) => {
    if (!confirm('Mark this reservation as picked up? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/admin/sessions/${sessionId}/picked-up`, {
        method: 'POST',
      });
      if (res.ok) loadSlots();
      else alert('Failed to mark as picked up');
    } catch (err) {
      alert('Error: ' + err);
    }
  };

  const handleSaveHangingWeight = async (sessionId: string, pricePerLb: number, depositAmountCents: number) => {
    setSavingWeight(sessionId);
    const weight = parseFloat(hangingWeights[sessionId]);
    if (!weight) return;
    // Use actual deposit paid — don't pass balance_due, let server calculate from payments table
    const balanceDue = null;
    const res = await fetch(`/api/admin/sessions/${sessionId}/hanging-weight`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hanging_weight_lbs: weight, balance_due: balanceDue }),
    });
    setSavingWeight(null);
    setExpandedSession(null);
    if (res.ok) {
      loadSlots();
    }
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800',
    deposit_paid: 'bg-green-100 text-green-800',
    locked: 'bg-blue-100 text-blue-800',
    processing: 'bg-amber-100 text-amber-800',
    beef_ready: 'bg-green-100 text-green-800',
  };

  const getFilteredSlots = () => {
    const filtered: Record<string, AnimalGroup> = {};
    for (const [animalName, group] of Object.entries(slots)) {
      const filteredSessions = group.sessions.filter(s => {
        if (statusFilter === 'confirmed') return s.status !== 'draft';
        if (statusFilter === 'draft') return s.status === 'draft';
        return true;
      });
      if (filteredSessions.length > 0) {
        filtered[animalName] = { ...group, sessions: filteredSessions };
      }
    }
    return filtered;
  };

  return (
    <AdminLayout title="Reservations">
      {loading ? (
        <p className="text-brand-gray">Loading reservations...</p>
      ) : Object.keys(slots).length === 0 ? (
        <p className="text-brand-gray">No reservations yet</p>
      ) : (
        <div>
          <div className="flex gap-2 mb-6">
            {['all', 'confirmed', 'draft'].map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition border ${
                  statusFilter === f
                    ? 'bg-brand-orange text-white'
                    : 'text-gray-300 hover:bg-white/5'
                }`}
                style={
                  statusFilter === f
                    ? undefined
                    : { background: 'var(--surface-1)', borderColor: 'var(--border)' }
                }
              >
                {f === 'all' ? 'All' : f === 'confirmed' ? 'Confirmed' : 'Drafts'}
              </button>
            ))}
          </div>
          <div className="space-y-8">
            {Object.entries(getFilteredSlots()).map(([animalName, group]) => (
            <div key={animalName}>
              <h3 className="font-display font-bold text-lg text-white mb-4">
                {group.animal?.name ?? "Unknown"} • Butcher {group.animal?.butcher_date ? new Date(group.animal.butcher_date).toLocaleDateString() : "TBD"}
              </h3>

              {group.sessions.length === 0 ? (
                <p className="text-sm text-brand-gray">No reservations yet</p>
              ) : (
                <div className="rounded-2xl shadow-sm overflow-hidden bg-gray-900 text-white">
                  <div className="overflow-x-auto -mx-4 px-4">
                    <table className="w-full">
                    <thead className="border-b text-gray-400" style={{background:"var(--surface-2)",borderColor:"var(--border)"}}>
                      <tr>
                        <th className="text-left px-6 py-3 font-semibold text-sm">Customer</th>
                        <th className="text-left px-6 py-3 font-semibold text-sm">Size</th>
                        <th className="text-left px-6 py-3 font-semibold text-sm">Deposit</th>
                        <th className="text-left px-6 py-3 font-semibold text-sm">Cut Sheet</th>
                        <th className="text-left px-6 py-3 font-semibold text-sm">Balance</th>
                        <th className="text-left px-6 py-3 font-semibold text-sm">Status</th>
                        <th className="text-left px-6 py-3 font-semibold text-sm">Booked</th>
                        <th className="text-left px-6 py-3 font-semibold text-sm">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.sessions.map((session) => (
                        <React.Fragment key={session.id}>
                        <tr className="border-b cursor-pointer hover:opacity-80" style={{borderColor:"var(--border)"}} onClick={() => setExpandedSession(expandedSession === session.id ? null : session.id)}>
                          <td className="px-6 py-4 font-semibold">
                            {session.customer_name}
                            {session.status === 'beef_ready' && !(session as any).pickup_appointment && (
                              <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                                Awaiting Pickup
                              </span>
                            )}
                            {(session as any).pickup_appointment && (
                              <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                                ✓ Pickup Scheduled
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm capitalize">{session.purchase_type}</td>
                          <td className="px-6 py-4 text-sm">
                            <div className="flex flex-col gap-1">
                              {session.deposit_paid ? (
                                <div className="flex flex-col">
                                  <span className="text-green-600 font-semibold text-xs">
                                    ✓ {session.payment_method === 'check' ? 'Check' : session.payment_method === 'cash' ? 'Cash' : session.payment_method === 'echeck' ? 'eCheck' : 'Card'}
                                  </span>
                                  {session.payment_method === 'check' && session.check_number && (
                                    <span className="text-gray-500 text-xs">
                                      #{session.check_number}
                                    </span>
                                  )}
                                </div>
                              ) : !session.deposit_paid && (session.intended_payment_method === 'check' || session.intended_payment_method === 'cash') ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDepositForm({ method: session.intended_payment_method || 'check', checkNumber: '' });
                                    setDepositModal({ open: true, sessionId: session.id, customerName: session.customer_name });
                                  }}
                                  className="px-2 py-1 bg-green-600 text-white text-xs rounded-lg font-semibold hover:bg-green-700"
                                >
                                  Mark Paid
                                </button>
                              ) : (
                                <span className="text-red-500 font-semibold text-xs">✗ Unpaid</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {session.cut_sheet_complete ? (
                              <span className="text-green-600 font-semibold">✓ Complete</span>
                            ) : (
                              <span className="text-brand-gray">Pending</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {(session.balance_due ?? 0) > 0 ? (
                              session.balance_paid ? (
                                <span className="text-green-600 font-semibold">✓ Paid</span>
                              ) : (
                                <span className="text-amber-600 font-semibold">
                                  ${(session.balance_due ?? 0).toFixed(2)} due
                                </span>
                              )
                            ) : (
                              <span className="text-brand-gray text-xs">TBD</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[session.status] || 'bg-gray-100'}`}>
                                {session.status === 'draft' ? 'Awaiting Payment' : session.status === 'deposit_paid' ? 'Confirmed' : session.status === 'locked' ? 'Cut Sheet Locked' : session.status === 'beef_ready' ? 'Beef Ready' : session.status === 'picked_up' ? 'Picked Up' : session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                              </span>
                              {session.status === 'deposit_paid' && session.payment_method === 'cash_check' && (
                                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                                  Cash/Check Due
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-brand-gray">
                            {new Date(session.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <div className="flex gap-3 flex-wrap">
                              {session.status === 'draft' && session.intended_payment_method === 'card' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const link = `https://www.legacylandandcattleco.com/payment?session_id=${session.id}`;
                                    navigator.clipboard.writeText(link).then(() => {
                                      alert(`Payment link copied!\n\n${link}`);
                                    }).catch(() => {
                                      prompt('Copy this payment link:', link);
                                    });
                                  }}
                                  className="text-blue-600 hover:text-blue-800 font-semibold text-sm"
                                >
                                  💳 Payment Link
                                </button>
                              )}
                              {session.status === 'draft' && session.intended_payment_method === 'card' && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setManualChargeSession(session); }}
                                  className="text-brand-orange hover:text-brand-orange-hover font-semibold text-sm"
                                >
                                  💳 Charge Card
                                </button>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleMoveOpen(session); }}
                                className="text-brand-orange hover:text-brand-orange-hover font-semibold"
                              >
                                Move
                              </button>
                              {(session.status === 'locked' || session.status === 'deposit_paid' || session.status === 'beef_ready') && (
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (session.status === 'beef_ready') return;
                                    const res = await fetch(`/api/admin/sessions/${session.id}/mark-ready`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                    });
                                    if (res.ok) {
                                      loadSlots(); // Refresh table
                                    } else {
                                      const error = await res.json();
                                      alert(`Error marking ready: ${error.error || 'Unknown error'}`);
                                    }
                                  }}
                                  disabled={session.status === 'beef_ready'}
                                  className="px-3 py-1 bg-green-600 text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {session.status === 'beef_ready' ? 'Ready ✓' : 'Mark Ready'}
                                </button>
                              )}
                              {session.status === 'beef_ready' && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handlePickedUp(session.id); }}
                                  className="text-brand-green hover:text-green-800 font-semibold ml-3"
                                >
                                  Picked Up ✓
                                </button>
                              )}
                              {!session.balance_paid && (session.balance_due ?? 0) > 0 && (
                                <button
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    handleMarkBalancePaid(session.id); 
                                  }}
                                  className="text-green-600 hover:text-green-800 font-semibold text-sm ml-3"
                                >
                                  Mark Paid ✓
                                </button>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleCancel(session); }}
                                className="text-red-400 hover:text-red-600 font-semibold"
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </tr>
                        {expandedSession === session.id && (
                          <tr key={session.id + '-expand'}>
                            <td colSpan={7} className="px-6 py-4 border-b text-white" style={{background:"var(--surface-2)",borderColor:"var(--border)"}}>
                              <div className="flex items-center gap-4">
                                <p className="text-sm font-semibold text-white">Hanging Weight (lbs):</p>
                                <input
                                  type="number"
                                  placeholder="e.g. 385"
                                  defaultValue={session.hanging_weight_lbs || ''}
                                  value={hangingWeights[session.id] !== undefined ? hangingWeights[session.id] : (session.hanging_weight_lbs ? String(session.hanging_weight_lbs) : '')}
                                  onChange={(e) => setHangingWeights({ ...hangingWeights, [session.id]: e.target.value })}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-32 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                                  style={{ borderColor: 'var(--border)' }}
                                />
                                {hangingWeights[session.id] && (
                                  <p className="text-sm text-gray-400">
                                    Est. Total: <span className="font-bold text-white">
                                      ${(parseFloat(hangingWeights[session.id]) * (session.price_per_lb ?? session.animals?.price_per_lb ?? 8.00)).toFixed(2)}
                                    </span>
                                    <span className="text-xs text-gray-500 ml-2">(balance calculated from actual deposit on save)</span>
                                  </p>
                                )}
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleSaveHangingWeight(session.id, session.price_per_lb ?? session.animals?.price_per_lb ?? 8.00, session.deposit_amount_cents || 0); }}
                                  disabled={!hangingWeights[session.id] || savingWeight === session.id}
                                  className="px-4 py-2 bg-brand-orange text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                                >
                                  {savingWeight === session.id ? 'Saving...' : 'Save & Calculate'}
                                </button>
                              </div>
                              <div className="flex items-center gap-4 mt-3">
                                <p className="text-sm font-semibold text-white whitespace-nowrap">
                                  Admin Notes:
                                </p>
                                <input
                                  type="text"
                                  placeholder="e.g. Tag 34, Black Steer"
                                  defaultValue={session.admin_notes || ''}
                                  onBlur={(e) => handleSaveAdminNotes(session.id, e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                                  style={{ borderColor: 'var(--border)' }}
                                />
                              </div>
                              <div className="mt-4 border-t border-gray-100 pt-4">
                                <p className="text-sm font-semibold text-white mb-2">
                                  Discount (applied to balance due)
                                </p>
                                <div className="flex gap-2 items-start flex-wrap">
                                  <select
                                    value={discountForm[session.id]?.type || 'fixed'}
                                    onChange={(e) => setDiscountForm({ 
                                      ...discountForm, 
                                      [session.id]: { 
                                        ...discountForm[session.id], 
                                        type: e.target.value 
                                      }
                                    })}
                                    className="px-3 py-2 border rounded-lg text-sm"
                                    style={{ borderColor: 'var(--border)' }}
                                  >
                                    <option value="fixed">$ Fixed</option>
                                    <option value="percent">% Percent</option>
                                  </select>
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder={discountForm[session.id]?.type === 'percent' ? 'e.g. 10' : 'e.g. 50'}
                                    value={discountForm[session.id]?.value || ''}
                                    onChange={(e) => setDiscountForm({ 
                                      ...discountForm, 
                                      [session.id]: { 
                                        ...discountForm[session.id], 
                                        value: e.target.value 
                                      }
                                    })}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-28 px-3 py-2 border rounded-lg text-sm"
                                    style={{ borderColor: 'var(--border)' }}
                                  />
                                  <input
                                    type="text"
                                    placeholder="Note (shows in email)"
                                    value={discountForm[session.id]?.note || ''}
                                    onChange={(e) => setDiscountForm({ 
                                      ...discountForm, 
                                      [session.id]: { 
                                        ...discountForm[session.id], 
                                        note: e.target.value 
                                      }
                                    })}
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex-1 min-w-48 px-3 py-2 border rounded-lg text-sm"
                                    style={{ borderColor: 'var(--border)' }}
                                  />
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      const form = discountForm[session.id];
                                      if (!form?.value) return;
                                      let discountAmount = parseFloat(form.value);
                                      if (form.type === 'percent') {
                                        discountAmount = (session.balance_due || 0) * (discountAmount / 100);
                                      }
                                      await fetch(`/api/admin/sessions/${session.id}/discount`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          discount_amount: discountAmount,
                                          discount_note: form.note || null,
                                        }),
                                      });
                                      loadSlots();
                                    }}
                                    className="px-4 py-2 bg-brand-orange text-white text-sm rounded-lg font-semibold hover:bg-brand-orange-hover"
                                  >
                                    Apply Discount
                                  </button>
                                </div>
                                {(session as any).discount_amount > 0 && (
                                  <div className="mt-2 text-sm text-green-700 font-semibold">
                                    ✓ Discount applied: -${(session as any).discount_amount?.toFixed(2)}
                                    {(session as any).discount_note && 
                                      <span className="text-gray-500 font-normal ml-2">
                                        "{(session as any).discount_note}"
                                      </span>
                                    }
                                  </div>
                                )}
                              </div>
                              <div className="mt-4 pt-4 border-t border-gray-100">
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    await fetch(`/api/admin/sessions/${session.id}/send-cut-sheet-email`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                    });
                                    alert('Cut sheet email sent to ' + session.customer_name);
                                    loadSlots();
                                  }}
                                  className="px-4 py-2 bg-brand-orange text-white text-sm rounded-lg font-semibold hover:bg-brand-orange-hover"
                                >
                                  📧 Send Cut Sheet Email
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              )}
            </div>
            ))}
          </div>
        </div>
      )}

      {moveModal.open && moveModal.session && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div
            className="rounded-2xl p-6 w-full max-w-md"
            style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
          >
            <h3 className="font-display font-bold text-xl text-white mb-2">Move Reservation</h3>
            <p className="text-sm text-gray-300 mb-4">
              Moving {moveModal.session.customer_name} ({moveModal.session.purchase_type}) to a new butcher date.
            </p>
            <select
              value={selectedAnimalId}
              onChange={(e) => setSelectedAnimalId(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-brand-orange bg-transparent text-white"
              style={{ borderColor: 'var(--border)' }}
            >
              <option value="">Select new butcher date...</option>
              {availableAnimals.map((animal) => (
                <option key={animal.id} value={animal.id}>
                  {animal.name} — {new Date(animal.butcher_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </option>
              ))}
            </select>
            <div className="flex gap-3">
              <button
                onClick={handleMove}
                disabled={!selectedAnimalId}
                className="flex-1 bg-brand-orange text-white py-2 rounded-lg font-semibold disabled:opacity-50"
              >
                Move Reservation
              </button>
              <button
                onClick={() => setMoveModal({ open: false, session: null })}
                className="flex-1 text-white py-2 rounded-lg font-semibold"
                style={{ background: 'var(--surface-2)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmModal.open && (
        <ConfirmModal
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal({ open: false, message: '', onConfirm: () => {} })}
        />
      )}

      {depositModal?.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div
            className="rounded-2xl p-6 w-full max-w-sm shadow-xl"
            style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
          >
            <h3 className="font-bold text-lg text-white mb-4">
              Confirm Deposit — {depositModal.customerName}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-white mb-1">
                  Payment Method
                </label>
                <select
                  value={depositForm.method}
                  onChange={(e) => setDepositForm({ ...depositForm, method: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange bg-transparent text-white"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <option value="check">Check</option>
                  <option value="cash">Cash</option>
                </select>
              </div>
              {depositForm.method === 'check' && (
                <div>
                  <label className="block text-sm font-semibold text-white mb-1">
                    Check Number
                  </label>
                  <input
                    type="text"
                    value={depositForm.checkNumber}
                    onChange={(e) => setDepositForm({ ...depositForm, checkNumber: e.target.value })}
                    placeholder="e.g. 1042"
                    className="w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange bg-transparent text-white"
                    style={{ borderColor: 'var(--border)' }}
                  />
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={async () => {
                  await fetch(`/api/admin/sessions/${depositModal.sessionId}/confirm-deposit`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      method: depositForm.method,
                      check_number: depositForm.checkNumber || null,
                    }),
                  });
                  setDepositModal(null);
                  loadSlots();
                }}
                className="flex-1 bg-brand-orange hover:bg-brand-orange-hover text-white py-2 rounded-lg font-semibold"
              >
                Confirm Payment
              </button>
              <button
                onClick={() => setDepositModal(null)}
                className="flex-1 text-white py-2 rounded-lg font-semibold"
                style={{ background: 'var(--surface-2)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {manualChargeSession && (
        <ManualChargeModal
          session={manualChargeSession}
          onClose={() => setManualChargeSession(null)}
          onSuccess={() => {
            setManualChargeSession(null);
            loadSlots();
          }}
        />
      )}
    </AdminLayout>
  );
}

function SquareChargeForm({
  sessionId,
  onSuccess,
}: {
  sessionId: string;
  onSuccess: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  async function handleToken(token: any) {
    if (!token?.token) {
      setError('Card tokenization failed. Please try again.');
      return;
    }
    setPaying(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/sessions/${sessionId}/charge-card`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id: token.token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Payment failed. Please try again.');
        setPaying(false);
        return;
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Payment failed');
      setPaying(false);
    }
  }

  return (
    <div>
      <PaymentForm
        applicationId={process.env.NEXT_PUBLIC_SQUARE_APP_ID!}
        locationId={process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID!}
        cardTokenizeResponseReceived={handleToken}
      >
        <CreditCard
          style={{
            '.input-container': {
              borderColor: '#E5E7EB',
              borderRadius: '12px',
            },
            '.input-container.is-focus': {
              borderColor: '#E85D24',
            },
            '.input-container.is-error': {
              borderColor: '#EF4444',
            },
            input: {
              color: '#111827',
              fontSize: '15px',
            },
          }}
        >
          {paying ? 'Processing…' : 'Charge Card'}
        </CreditCard>
      </PaymentForm>
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
    </div>
  );
}

function ManualChargeModal({
  session,
  onClose,
  onSuccess,
}: {
  session: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div
        className="rounded-2xl p-6 w-full max-w-md"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
      >
        <h2 className="text-white font-semibold text-lg mb-2">
          Charge Card — {session.customer_name}
        </h2>
        <p className="text-gray-400 text-sm mb-6">
          {session.purchase_type} deposit
        </p>
        <SquareChargeForm
          sessionId={session.id}
          onSuccess={onSuccess}
        />
        <button
          onClick={onClose}
          className="mt-4 w-full py-2 rounded-lg text-white font-semibold hover:bg-white/5"
          style={{ background: 'var(--surface-2)' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

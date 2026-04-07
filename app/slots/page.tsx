'use client';

import React, { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';

function ConfirmModal({ message, onConfirm, onCancel }: { message: string, onConfirm: () => void, onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <p className="text-brand-dark font-semibold mb-6 text-center">{message}</p>
        <div className="flex gap-3">
          <button onClick={onConfirm} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg font-semibold">
            Yes, Delete
          </button>
          <button onClick={onCancel} className="flex-1 bg-brand-gray-light text-brand-dark py-2 rounded-lg font-semibold">
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
  const [hangingWeights, setHangingWeights] = useState<Record<string, string>>({});
  const [savingWeight, setSavingWeight] = useState<string | null>(null);

  const handleSaveAdminNotes = async (sessionId: string, notes: string) => {
    await fetch(`/api/admin/sessions/${sessionId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_notes: notes }),
    });
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
    const cancelMessage = `Cancel reservation for ${session.customer_name}? Their deposit will need to be refunded manually through Stripe.`;
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
    const balanceDue = (weight * pricePerLb) - (depositAmountCents / 100);
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
    draft: 'bg-gray-100 text-gray-800',
    deposit_paid: 'bg-green-100 text-green-800',
    locked: 'bg-blue-100 text-blue-800',
    processing: 'bg-amber-100 text-amber-800',
    beef_ready: 'bg-green-100 text-green-800',
  };

  return (
    <AdminLayout title="Reservations">
      {loading ? (
        <p className="text-brand-gray">Loading reservations...</p>
      ) : Object.keys(slots).length === 0 ? (
        <p className="text-brand-gray">No reservations yet</p>
      ) : (
        <div className="space-y-8">
          {Object.entries(slots).map(([animalName, group]) => (
            <div key={animalName}>
              <h3 className="font-display font-bold text-lg text-brand-dark mb-4">
                {group.animal?.name ?? "Unknown"} • Butcher {group.animal?.butcher_date ? new Date(group.animal.butcher_date).toLocaleDateString() : "TBD"}
              </h3>

              {group.sessions.length === 0 ? (
                <p className="text-sm text-brand-gray">No reservations yet</p>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-brand-gray-light border-b border-brand-gray-light">
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
                        <tr className="border-b border-brand-gray-light hover:bg-brand-warm cursor-pointer" onClick={() => setExpandedSession(expandedSession === session.id ? null : session.id)}>
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
                            {session.deposit_paid ? (
                              <span className="text-green-600 font-semibold">✓</span>
                            ) : (
                              <span className="text-red-600 font-semibold">✗</span>
                            )}
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
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[session.status] || 'bg-gray-100'}`}>
                              {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-brand-gray">
                            {new Date(session.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <div className="flex gap-3">
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
                            <td colSpan={7} className="px-6 py-4 bg-brand-warm border-b border-brand-gray-light">
                              <div className="flex items-center gap-4">
                                <p className="text-sm font-semibold text-brand-dark">Hanging Weight (lbs):</p>
                                <input
                                  type="number"
                                  placeholder="e.g. 385"
                                  defaultValue={session.hanging_weight_lbs || ''}
                                  value={hangingWeights[session.id] !== undefined ? hangingWeights[session.id] : (session.hanging_weight_lbs ? String(session.hanging_weight_lbs) : '')}
                                  onChange={(e) => setHangingWeights({ ...hangingWeights, [session.id]: e.target.value })}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-32 px-3 py-2 border border-brand-gray-light rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                                />
                                {hangingWeights[session.id] && (
                                  <p className="text-sm text-brand-gray">
                                    Balance Due: <span className="font-bold text-brand-dark">
                                      ${((parseFloat(hangingWeights[session.id]) * (session.price_per_lb ?? 8.25)) - (session.deposit_amount_cents ?? 0) / 100).toFixed(2)}
                                    </span>
                                  </p>
                                )}
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleSaveHangingWeight(session.id, session.price_per_lb ?? 8.25, session.deposit_amount_cents ?? 0); }}
                                  disabled={!hangingWeights[session.id] || savingWeight === session.id}
                                  className="px-4 py-2 bg-brand-orange text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                                >
                                  {savingWeight === session.id ? 'Saving...' : 'Save & Calculate'}
                                </button>
                              </div>
                              <div className="flex items-center gap-4 mt-3">
                                <p className="text-sm font-semibold text-brand-dark whitespace-nowrap">
                                  Admin Notes:
                                </p>
                                <input
                                  type="text"
                                  placeholder="e.g. Tag 34, Black Steer"
                                  defaultValue={session.admin_notes || ''}
                                  onBlur={(e) => handleSaveAdminNotes(session.id, e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex-1 px-3 py-2 border border-brand-gray-light rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                                />
                              </div>
                            </td>
                          </tr>
                        )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {moveModal.open && moveModal.session && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="font-display font-bold text-xl mb-2">Move Reservation</h3>
            <p className="text-sm text-brand-gray mb-4">
              Moving {moveModal.session.customer_name} ({moveModal.session.purchase_type}) to a new butcher date.
            </p>
            <select
              value={selectedAnimalId}
              onChange={(e) => setSelectedAnimalId(e.target.value)}
              className="w-full px-4 py-2 border border-brand-gray-light rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-brand-orange"
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
                className="flex-1 bg-brand-gray-light text-brand-dark py-2 rounded-lg font-semibold"
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
    </AdminLayout>
  );
}

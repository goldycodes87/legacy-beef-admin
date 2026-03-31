'use client';

import { useEffect, useState } from 'react';
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
                {group.animal.name} • Butcher {new Date(group.animal.butcher_date).toLocaleDateString()}
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
                        <th className="text-left px-6 py-3 font-semibold text-sm">Status</th>
                        <th className="text-left px-6 py-3 font-semibold text-sm">Booked</th>
                        <th className="text-left px-6 py-3 font-semibold text-sm">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.sessions.map((session) => (
                        <tr key={session.id} className="border-b border-brand-gray-light hover:bg-brand-warm">
                          <td className="px-6 py-4 font-semibold">{session.customer_name}</td>
                          <td className="px-6 py-4 text-sm capitalize">{session.purchase_type}</td>
                          <td className="px-6 py-4 text-sm">
                            {session.deposit_paid ? (
                              <span className="text-green-600 font-semibold">✓ Paid</span>
                            ) : (
                              <span className="text-amber-600">Pending</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {session.cut_sheet_complete ? (
                              <span className="text-green-600 font-semibold">✓ Complete</span>
                            ) : (
                              <span className="text-brand-gray">Pending</span>
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
                                onClick={() => handleMoveOpen(session)}
                                className="text-brand-orange hover:text-brand-orange-hover font-semibold"
                              >
                                Move
                              </button>
                              <button
                                onClick={() => handleCancel(session)}
                                className="text-red-400 hover:text-red-600 font-semibold"
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </tr>
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

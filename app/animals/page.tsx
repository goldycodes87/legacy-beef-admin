'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import Link from 'next/link';

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

interface Animal {
  id: string;
  name: string;
  animal_type: string;
  total_animals: number;
  units_used: number;
  butcher_date: string;
  estimated_ready_date: string;
  price_per_lb: number;
  status: string;
  wagyu_active: boolean;
}

function ReservationsTable({ animalId }: { animalId: string }) {
  const [reservations, setReservations] = useState<any[]>([]);
  const [loadingRes, setLoadingRes] = useState(true);

  async function loadReservations() {
    const res = await fetch(`/api/admin/slots?animal_id=${animalId}`);
    const data = await res.json();
    setReservations(Array.isArray(data) ? data : []);
    setLoadingRes(false);
  }

  useEffect(() => {
    loadReservations();
  }, [animalId]);

  async function handleCancel(sessionId: string) {
    if (!confirm('Cancel this reservation?')) return;
    await fetch(`/api/admin/sessions/${sessionId}/cancel`, { method: 'POST' });
    // Re-fetch reservations after cancel
    const updated = await fetch(`/api/admin/slots?animal_id=${animalId}`);
    const data = await updated.json();
    setReservations(Array.isArray(data) ? data : []);
  }

  if (loadingRes) return <div className="text-sm text-gray-500">Loading...</div>;
  if (reservations.length === 0) return null;

  return (
    <div className="mb-4">
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-white border-b">
          <tr>
            <th className="px-4 py-2 text-left font-semibold text-gray-900">Customer Name</th>
            <th className="px-4 py-2 text-left font-semibold text-gray-900">Email</th>
            <th className="px-4 py-2 text-left font-semibold text-gray-900">Purchase Type</th>
            <th className="px-4 py-2 text-left font-semibold text-gray-900">Deposit Paid</th>
            <th className="px-4 py-2 text-left font-semibold text-gray-900">Status</th>
            <th className="px-4 py-2 text-left font-semibold text-gray-900">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {reservations.map(r => (
            <tr key={r.id}>
              <td className="px-4 py-2">{r.customer_name || '—'}</td>
              <td className="px-4 py-2 text-gray-500">{r.customer_email || '—'}</td>
              <td className="px-4 py-2 capitalize">{r.purchase_type}</td>
              <td className="px-4 py-2">
                {r.deposit_paid ? (
                  <span className="text-green-600 font-semibold">✓</span>
                ) : (
                  <span className="text-red-600 font-semibold">✗</span>
                )}
              </td>
              <td className="px-4 py-2 capitalize">{r.status}</td>
              <td className="px-4 py-2">
                {r.status !== 'cancelled' && (
                  <button
                    onClick={() => handleCancel(r.id)}
                    className="text-red-400 hover:text-red-600 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </div>
  );
}

export default function AnimalsPage() {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    butcher_date: '',
    estimated_ready_date: '',
    grass_fed_count: 0,
    grain_finished_count: 0,
    wagyu_count: 0,
  });
  const [sortBy, setSortBy] = useState<'soonest'|'latest'|'animals'|'full'>('soonest');
  const [editModal, setEditModal] = useState<{open: boolean, date: string, animals: Animal[]}>({open: false, date: '', animals: []});
  const [confirmModal, setConfirmModal] = useState<{open: boolean, message: string, onConfirm: () => void}>({open: false, message: '', onConfirm: () => {}});
  const [errorMessage, setErrorMessage] = useState('');
  const [expandedReservations, setExpandedReservations] = useState<string | null>(null);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editForm, setEditForm] = useState<{butcher_date: string, estimated_ready_date: string, grass_fed_count: number, grain_finished_count: number, wagyu_count: number}>({butcher_date: '', estimated_ready_date: '', grass_fed_count: 0, grain_finished_count: 0, wagyu_count: 0});

  useEffect(() => {
    loadAnimals();
  }, []);

  const loadAnimals = async () => {
    try {
      const res = await fetch('/api/admin/animals');
      const data = await res.json();
      setAnimals(data);
    } catch (err) {
      console.error('Failed to load animals:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const total = formData.grass_fed_count + formData.grain_finished_count + formData.wagyu_count;
    if (total === 0) return;
    try {
      const res = await fetch('/api/admin/animals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error('Failed to create butcher date');
      setShowModal(false);
      setFormData({ butcher_date: '', estimated_ready_date: '', grass_fed_count: 0, grain_finished_count: 0, wagyu_count: 0 });
      loadAnimals();
    } catch (err) {
      console.error('Error:', err);
    }
  };

  // Group animals by butcher_date
  const groupedByDate = animals.reduce((acc, animal) => {
    const date = animal.butcher_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(animal);
    return acc;
  }, {} as Record<string, Animal[]>);

  // Sort the grouped dates (filter archived if not showing)
  const sortedDates = Object.keys(groupedByDate).filter(date => {
    if (!showArchived) {
      return !groupedByDate[date].every(a => a.status === 'archived');
    }
    return true;
  }).sort((a, b) => {
    if (sortBy === 'soonest') return new Date(a).getTime() - new Date(b).getTime();
    if (sortBy === 'latest') return new Date(b).getTime() - new Date(a).getTime();
    if (sortBy === 'animals') {
      const totalA = groupedByDate[a].reduce((s, x) => s + x.total_animals, 0);
      const totalB = groupedByDate[b].reduce((s, x) => s + x.total_animals, 0);
      return totalB - totalA;
    }
    if (sortBy === 'full') {
      const pctA = groupedByDate[a].reduce((s, x) => s + x.units_used, 0) / groupedByDate[a].reduce((s, x) => s + x.total_animals, 0);
      const pctB = groupedByDate[b].reduce((s, x) => s + x.units_used, 0) / groupedByDate[b].reduce((s, x) => s + x.total_animals, 0);
      return pctB - pctA;
    }
    return 0;
  });

  const handleEditOpen = (date: string, animals: Animal[]) => {
    const grassFed = animals.find(a => a.animal_type === 'grass_fed');
    const grainFinished = animals.find(a => a.animal_type === 'grain_finished');
    const wagyu = animals.find(a => a.animal_type === 'wagyu');
    setEditForm({
      butcher_date: date,
      estimated_ready_date: animals[0]?.estimated_ready_date || '',
      grass_fed_count: grassFed?.total_animals || 0,
      grain_finished_count: grainFinished?.total_animals || 0,
      wagyu_count: wagyu?.total_animals || 0,
    });
    setEditModal({ open: true, date, animals });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Update each animal record individually
      for (const animal of editModal.animals) {
        let newCount = 0;
        if (animal.animal_type === 'grass_fed') newCount = editForm.grass_fed_count;
        if (animal.animal_type === 'grain_finished') newCount = editForm.grain_finished_count;
        if (animal.animal_type === 'wagyu') newCount = editForm.wagyu_count;

        await fetch(`/api/admin/animals/${animal.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            total_animals: newCount,
            butcher_date: editForm.butcher_date,
            estimated_ready_date: editForm.estimated_ready_date,
          }),
        });
      }
      setEditModal({ open: false, date: '', animals: [] });
      loadAnimals();
    } catch (err) {
      console.error('Edit error:', err);
    }
  };

  const handleDelete = async (animal: Animal) => {
    // Check for active sessions first
    const res = await fetch(`/api/admin/cut-sheets`);
    const allSessions = await res.json();
    const activeSessions = allSessions.filter(
      (s: any) => s.animals?.[0]?.id === animal.id &&
        s.status !== 'cancelled' &&
        s.status !== 'picked_up'
    );

    if (activeSessions.length > 0) {
      alert(
        `Cannot delete — ${activeSessions.length} active reservation(s) on this date. Archive instead.`
      );
      return;
    }

    const deleteMessage = `Delete ${animal.animal_type.replace('_', ' ')} from this butcher date? This cannot be undone.`;
    setConfirmModal({
      open: true,
      message: deleteMessage,
      onConfirm: async () => {
        try {
          await fetch(`/api/admin/animals/${animal.id}`, { method: 'DELETE' });
          setConfirmModal({ open: false, message: '', onConfirm: () => {} });
          loadAnimals();
        } catch (err) {
          console.error('Delete error:', err);
          setConfirmModal({ open: false, message: '', onConfirm: () => {} });
        }
      }
    });
  };

  const handleDeleteDate = async (date: string, dateAnimals: Animal[]) => {
    // Check for reservations across all animals on this date
    const hasReservations = await Promise.all(
      dateAnimals.map(async (animal) => {
        const res = await fetch(`/api/admin/animals/${animal.id}/reservations`);
        const data = await res.json();
        return data.count > 0;
      })
    );

    if (hasReservations.some(Boolean)) {
      setErrorMessage('This butcher date has active reservations. Go to Slots to move or cancel them before deleting this date.');
      return;
    }

    const deleteMessage = `Delete entire butcher date of ${new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}? This cannot be undone.`;
    setConfirmModal({
      open: true,
      message: deleteMessage,
      onConfirm: async () => {
        try {
          await Promise.all(dateAnimals.map(animal =>
            fetch(`/api/admin/animals/${animal.id}`, { method: 'DELETE' })
          ));
          setConfirmModal({ open: false, message: '', onConfirm: () => {} });
          loadAnimals();
        } catch (err) {
          console.error('Delete date error:', err);
          setConfirmModal({ open: false, message: '', onConfirm: () => {} });
        }
      }
    });
  };

  async function handleArchive(animalId: string) {
    setArchiving(true);
    const res = await fetch(`/api/admin/animals/${animalId}/archive`, {
      method: 'POST',
    });
    const result = await res.json();
    if (result.error) {
      alert(result.error);
    } else {
      setArchiveId(null);
      loadAnimals();
    }
    setArchiving(false);
  }

  return (
    <AdminLayout title="Butcher Dates">
      {/* Header row */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-display font-bold text-2xl">Butcher Dates</h2>
        <button
          onClick={() => setShowModal(true)}
          className="bg-brand-orange hover:bg-brand-orange-hover text-white px-4 py-2 rounded-lg font-semibold"
        >
          + Add Butcher Date
        </button>
      </div>

      {/* Sort controls */}
      <div className="flex gap-2 mb-4">
        {(['soonest', 'latest', 'animals', 'full'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSortBy(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              sortBy === s
                ? 'bg-brand-orange text-white'
                : 'bg-white text-brand-gray border border-brand-gray-light hover:border-brand-orange'
            }`}
          >
            {s === 'soonest' ? 'Soonest First' : s === 'latest' ? 'Latest First' : s === 'animals' ? 'Most Animals' : 'Most Full'}
          </button>
        ))}
      </div>

      {/* Show Archived toggle */}
      <div className="flex items-center gap-4 mb-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm font-medium text-gray-700">Show Archived</span>
        </label>
      </div>

      {loading ? (
        <p className="text-brand-gray">Loading...</p>
      ) : sortedDates.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl">
          <p className="text-2xl mb-2">🐄</p>
          <p className="font-semibold text-brand-dark">No butcher dates yet</p>
          <p className="text-sm text-brand-gray mt-1">Click "+ Add Butcher Date" to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {sortedDates.map((date) => {
            const dateAnimals = groupedByDate[date];
            const totalHead = dateAnimals.reduce((s, a) => s + a.total_animals, 0);
            const totalUnits = dateAnimals.reduce((s, a) => s + a.units_used, 0);
            const totalCapacity = dateAnimals.reduce((s, a) => s + a.total_animals, 0);
            const pct = totalCapacity > 0 ? (totalUnits / totalCapacity) * 100 : 0;
            const barColor = pct >= 100 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-green-500';
            const readyDate = dateAnimals[0]?.estimated_ready_date;
            const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
            const formattedReady = readyDate ? new Date(readyDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—';

            return (
              <div key={date} className="bg-white rounded-2xl shadow-sm p-6 flex flex-col gap-4">
                {/* Card header */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-display font-bold text-lg text-brand-dark">{formattedDate}</p>
                    <p className="text-xs text-brand-gray mt-0.5">Est. Ready: {formattedReady}</p>
                  </div>
                  <span className="text-xs font-semibold bg-brand-warm text-brand-dark px-2 py-1 rounded-full">
                    {totalHead} head total
                  </span>
                </div>

                {/* Overall capacity bar */}
                <div>
                  <div className="flex justify-between text-xs text-brand-gray mb-1">
                    <span>Capacity</span>
                    <span>{totalUnits.toFixed(1)} / {totalCapacity} units used</span>
                  </div>
                  <div className="w-full bg-brand-gray-light rounded-full h-2 overflow-hidden">
                    <div className={`${barColor} h-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </div>

                {/* Per-type rows */}
                <div className="space-y-3">
                  {dateAnimals.map((animal) => {
                    const typePct = animal.total_animals > 0 ? (animal.units_used / animal.total_animals) * 100 : 0;
                    const typeLabel = animal.animal_type === 'grass_fed' ? '🌿 Grass-Fed' : animal.animal_type === 'grain_finished' ? '🌾 Grain-Finished' : '⭐ American Wagyu';
                    const typeBg = animal.animal_type === 'grass_fed' ? 'bg-green-100 text-green-800' : animal.animal_type === 'grain_finished' ? 'bg-amber-100 text-amber-800' : 'bg-purple-100 text-purple-800';
                    return (
                      <div key={animal.id} className="flex items-center justify-between gap-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${typeBg}`}>{typeLabel}</span>
                        <div className="flex-1">
                          <div className="w-full bg-brand-gray-light rounded-full h-1.5 overflow-hidden">
                            <div className="bg-brand-orange h-full" style={{ width: `${Math.min(typePct, 100)}%` }} />
                          </div>
                        </div>
                        <span className="text-xs text-brand-gray whitespace-nowrap">{animal.units_used.toFixed(1)}/{animal.total_animals}</span>
                        <button
                          onClick={() => handleDelete(animal)}
                          className="text-red-400 hover:text-red-600 text-xs font-semibold"
                          title="Remove this type"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Card footer */}
                <div className="pt-2 border-t border-brand-gray-light flex gap-3">
                  <button
                    onClick={() => handleEditOpen(date, dateAnimals)}
                    className="flex-1 text-center text-sm font-semibold text-brand-orange hover:text-brand-orange-hover"
                  >
                    Edit This Date →
                  </button>
                  <button
                    onClick={() => handleDeleteDate(date, dateAnimals)}
                    className="text-sm font-semibold text-red-400 hover:text-red-600"
                  >
                    Delete Date
                  </button>
                </div>

                {/* View Reservations + Archive buttons */}
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() =>
                      setExpandedReservations(expandedReservations === dateAnimals[0]?.id ? null : dateAnimals[0]?.id)
                    }
                    className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 rounded font-medium text-sm hover:bg-blue-200"
                  >
                    {expandedReservations === dateAnimals[0]?.id ? 'Hide' : 'View'} Reservations
                  </button>
                  <button
                    onClick={() => setArchiveId(dateAnimals[0]?.id)}
                    className="flex-1 px-3 py-2 bg-orange-100 text-orange-700 rounded font-medium text-sm hover:bg-orange-200"
                  >
                    Archive Date
                  </button>
                </div>

                {/* Expanded reservations panel */}
                {expandedReservations === dateAnimals[0]?.id && (
                  <div className="mt-4 bg-gray-50 rounded-lg p-4">
                    <p className="font-semibold text-gray-900 mb-3">Reservations</p>
                    {dateAnimals.map((animal) => (
                      <ReservationsTable key={animal.id} animalId={animal.id} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ADD modal — keep exactly as-is */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
            <h3 className="font-display font-bold text-xl mb-4">Add Butcher Date</h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Butcher Date */}
              <div>
                <label className="block text-sm font-semibold text-brand-dark mb-1">
                  Butcher Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.butcher_date}
                  onChange={(e) => {
                    const bd = e.target.value;
                    const ready = bd ? new Date(new Date(bd).getTime() + 21 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : '';
                    setFormData({ ...formData, butcher_date: bd, estimated_ready_date: ready });
                  }}
                  className="w-full px-4 py-2 border border-brand-gray-light rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange"
                  required
                />
              </div>

              {/* Est. Ready Date */}
              <div>
                <label className="block text-sm font-semibold text-brand-dark mb-1">
                  Est. Ready Date <span className="text-brand-gray text-xs font-normal">(auto-fills +21 days)</span>
                </label>
                <input
                  type="date"
                  value={formData.estimated_ready_date}
                  onChange={(e) => setFormData({ ...formData, estimated_ready_date: e.target.value })}
                  className="w-full px-4 py-2 border border-brand-gray-light rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange"
                />
              </div>

              {/* Head count by type */}
              <div>
                <label className="block text-sm font-semibold text-brand-dark mb-2">
                  Head Count by Type <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="w-32 text-sm text-brand-dark">🌿 Grass-Fed</span>
                    <input
                      type="number"
                      min="0"
                      value={formData.grass_fed_count}
                      onChange={(e) => setFormData({ ...formData, grass_fed_count: parseInt(e.target.value) || 0 })}
                      className="w-24 px-3 py-2 border border-brand-gray-light rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                    />
                    <span className="text-xs text-brand-gray">head</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-32 text-sm text-brand-dark">🌾 Grain-Finished</span>
                    <input
                      type="number"
                      min="0"
                      value={formData.grain_finished_count}
                      onChange={(e) => setFormData({ ...formData, grain_finished_count: parseInt(e.target.value) || 0 })}
                      className="w-24 px-3 py-2 border border-brand-gray-light rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                    />
                    <span className="text-xs text-brand-gray">head</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-32 text-sm text-brand-dark">⭐ Wagyu</span>
                    <input
                      type="number"
                      min="0"
                      value={formData.wagyu_count}
                      onChange={(e) => setFormData({ ...formData, wagyu_count: parseInt(e.target.value) || 0 })}
                      className="w-24 px-3 py-2 border border-brand-gray-light rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                    />
                    <span className="text-xs text-brand-gray">head</span>
                  </div>
                </div>
                {formData.grass_fed_count + formData.grain_finished_count + formData.wagyu_count === 0 && (
                  <p className="text-red-500 text-xs mt-1">At least 1 head required</p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={formData.grass_fed_count + formData.grain_finished_count + formData.wagyu_count === 0}
                  className="flex-1 bg-brand-orange hover:bg-brand-orange-hover text-white py-2 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Butcher Date
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-brand-gray-light text-brand-dark py-2 rounded-lg font-semibold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT modal */}
      {editModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
            <h3 className="font-display font-bold text-xl mb-4">Edit Butcher Date</h3>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-brand-dark mb-1">Butcher Date</label>
                <input
                  type="date"
                  value={editForm.butcher_date}
                  onChange={(e) => {
                    const bd = e.target.value;
                    const ready = bd ? new Date(new Date(bd).getTime() + 21 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : '';
                    setEditForm({ ...editForm, butcher_date: bd, estimated_ready_date: ready });
                  }}
                  className="w-full px-4 py-2 border border-brand-gray-light rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-brand-dark mb-1">Est. Ready Date</label>
                <input
                  type="date"
                  value={editForm.estimated_ready_date}
                  onChange={(e) => setEditForm({ ...editForm, estimated_ready_date: e.target.value })}
                  className="w-full px-4 py-2 border border-brand-gray-light rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-brand-dark mb-2">Head Count by Type</label>
                <div className="space-y-2">
                  {editModal.animals.map((animal) => {
                    const key = animal.animal_type === 'grass_fed' ? 'grass_fed_count' : animal.animal_type === 'grain_finished' ? 'grain_finished_count' : 'wagyu_count';
                    const label = animal.animal_type === 'grass_fed' ? '🌿 Grass-Fed' : animal.animal_type === 'grain_finished' ? '🌾 Grain-Finished' : '⭐ Wagyu';
                    const minValue = Math.ceil(animal.units_used);
                    return (
                      <div key={animal.id} className="flex items-center gap-3">
                        <span className="w-36 text-sm text-brand-dark">{label}</span>
                        <input
                          type="number"
                          min={minValue}
                          value={editForm[key as keyof typeof editForm]}
                          onChange={(e) => setEditForm({ ...editForm, [key]: parseInt(e.target.value) || 0 })}
                          className="w-24 px-3 py-2 border border-brand-gray-light rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                        />
                        <span className="text-xs text-brand-gray">head (min: {minValue} sold)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-brand-orange hover:bg-brand-orange-hover text-white py-2 rounded-lg font-semibold">
                  Save Changes
                </button>
                <button type="button" onClick={() => setEditModal({ open: false, date: '', animals: [] })} className="flex-1 bg-brand-gray-light text-brand-dark py-2 rounded-lg font-semibold">
                  Cancel
                </button>
              </div>
            </form>
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

      {errorMessage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <p className="text-brand-dark font-semibold mb-6 text-center">{errorMessage}</p>
            <button
              onClick={() => setErrorMessage('')}
              className="w-full bg-brand-orange text-white py-2 rounded-lg font-semibold"
            >
              Understood
            </button>
          </div>
        </div>
      )}

      {/* Archive confirmation modal */}
      {archiveId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <p className="text-lg font-semibold mb-4">Archive this butcher date?</p>
            <p className="text-gray-600 mb-6">
              It will be hidden from the main view. Active reservations will block archival.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setArchiveId(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded text-gray-700 font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleArchive(archiveId)}
                disabled={archiving}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded font-medium hover:bg-orange-700 disabled:opacity-50"
              >
                {archiving ? 'Archiving...' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

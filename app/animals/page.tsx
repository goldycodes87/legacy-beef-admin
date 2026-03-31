'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import Link from 'next/link';

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

  const statusColors: Record<string, string> = {
    available: 'bg-green-100 text-green-800',
    'fully-booked': 'bg-amber-100 text-amber-800',
    processing: 'bg-blue-100 text-blue-800',
    complete: 'bg-gray-100 text-gray-800',
  };

  return (
    <AdminLayout title="Animals">
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-display font-bold text-2xl">Animal Inventory</h2>
        <button
          onClick={() => setShowModal(true)}
          className="bg-brand-orange hover:bg-brand-orange-hover text-white px-4 py-2 rounded-lg font-semibold"
        >
          + Add Butcher Date
        </button>
      </div>

      {loading ? (
        <p className="text-brand-gray">Loading animals...</p>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-brand-gray-light border-b border-brand-gray-light">
              <tr>
                <th className="text-left px-6 py-3 font-semibold text-sm">Butcher Date / Type</th>
                <th className="text-left px-6 py-3 font-semibold text-sm">Type</th>
                <th className="text-left px-6 py-3 font-semibold text-sm">Butcher Date</th>
                <th className="text-left px-6 py-3 font-semibold text-sm">Ready Date</th>
                <th className="text-left px-6 py-3 font-semibold text-sm">Capacity</th>
                <th className="text-left px-6 py-3 font-semibold text-sm">Status</th>
                <th className="text-left px-6 py-3 font-semibold text-sm">Actions</th>
              </tr>
            </thead>
            <tbody>
              {animals.map((animal) => (
                <tr key={animal.id} className="border-b border-brand-gray-light hover:bg-brand-warm">
                  <td className="px-6 py-4">
                    <p className="font-semibold">{new Date(animal.butcher_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                    <p className="text-xs text-brand-gray">{animal.total_animals} head</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100">
                      {animal.animal_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">{new Date(animal.butcher_date + 'T00:00:00').toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm">{animal.estimated_ready_date ? new Date(animal.estimated_ready_date + 'T00:00:00').toLocaleDateString() : '—'}</td>
                  <td className="px-6 py-4 text-sm">
                    <div className="w-32 bg-brand-gray-light rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-brand-orange h-full"
                        style={{
                          width: `${Math.min(((animal.units_used / animal.total_animals) * 100) || 0, 100)}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-brand-gray mt-1">{animal.units_used.toFixed(1)} / {animal.total_animals}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[animal.status] || 'bg-gray-100'}`}>
                      {animal.status.charAt(0).toUpperCase() + animal.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <button className="text-brand-orange hover:text-brand-orange-hover font-semibold">
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Butcher Date Modal */}
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
                {/* Validation: at least 1 head total */}
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
    </AdminLayout>
  );
}

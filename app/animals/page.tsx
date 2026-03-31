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
    name: '',
    animal_type: 'Grass-Fed',
    total_animals: 1,
    butcher_date: '',
    estimated_ready_date: '',
    price_per_lb: 8.0,
    status: 'available',
    wagyu_active: false,
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

    try {
      const res = await fetch('/api/admin/animals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error('Failed to create animal');

      setShowModal(false);
      setFormData({
        name: '',
        animal_type: 'Grass-Fed',
        total_animals: 1,
        butcher_date: '',
        estimated_ready_date: '',
        price_per_lb: 8.0,
        status: 'available',
        wagyu_active: false,
      });

      loadAnimals();
    } catch (err) {
      console.error('Error creating animal:', err);
    }
  };

  const typeColors: Record<string, string> = {
    'Grass-Fed': 'bg-green-100 text-green-800',
    'Grain-Finished': 'bg-amber-100 text-amber-800',
    'Wagyu': 'bg-purple-100 text-purple-800',
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
          + Add Animal
        </button>
      </div>

      {loading ? (
        <p className="text-brand-gray">Loading animals...</p>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-brand-gray-light border-b border-brand-gray-light">
              <tr>
                <th className="text-left px-6 py-3 font-semibold text-sm">Name</th>
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
                  <td className="px-6 py-4 font-semibold">{animal.name}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${typeColors[animal.animal_type] || 'bg-gray-100'}`}>
                      {animal.animal_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">{new Date(animal.butcher_date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm">{new Date(animal.estimated_ready_date).toLocaleDateString()}</td>
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

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
            <h3 className="font-display font-bold text-xl mb-4">Add Animal</h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="text"
                placeholder="Animal Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-brand-gray-light rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange"
                required
              />

              <select
                value={formData.animal_type}
                onChange={(e) => setFormData({ ...formData, animal_type: e.target.value })}
                className="w-full px-4 py-2 border border-brand-gray-light rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange"
              >
                <option>Grass-Fed</option>
                <option>Grain-Finished</option>
                <option>Wagyu</option>
              </select>

              <input
                type="number"
                placeholder="Number of Animals"
                value={formData.total_animals}
                onChange={(e) => setFormData({ ...formData, total_animals: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-brand-gray-light rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange"
                min="1"
                required
              />

              <input
                type="date"
                value={formData.butcher_date}
                onChange={(e) => setFormData({ ...formData, butcher_date: e.target.value })}
                className="w-full px-4 py-2 border border-brand-gray-light rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange"
                required
              />

              <input
                type="date"
                value={formData.estimated_ready_date}
                onChange={(e) => setFormData({ ...formData, estimated_ready_date: e.target.value })}
                className="w-full px-4 py-2 border border-brand-gray-light rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange"
              />

              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  placeholder="Price /lb (Whole)"
                  value={formData.price_per_lb}
                  onChange={(e) => setFormData({ ...formData, price_per_lb: parseFloat(e.target.value) })}
                  step="0.01"
                  className="px-3 py-2 border border-brand-gray-light rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                />
                <input type="number" placeholder="Half" step="0.01" disabled className="px-3 py-2 border border-brand-gray-light rounded-lg text-sm bg-gray-50" />
                <input type="number" placeholder="Quarter" step="0.01" disabled className="px-3 py-2 border border-brand-gray-light rounded-lg text-sm bg-gray-50" />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-brand-orange hover:bg-brand-orange-hover text-white py-2 rounded-lg font-semibold"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-brand-gray-light text-brand-dark py-2 rounded-lg font-semibold hover:bg-brand-gray-light/80"
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

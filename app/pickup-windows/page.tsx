'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import AdminLayout from '@/components/AdminLayout';

interface PickupWindow {
  id: string;
  label: string;
  pickup_date: string;
  start_time: string;
  end_time: string;
  max_slots: number;
  active: boolean;
}

export default function PickupWindowsPage() {
  const [windows, setWindows] = useState<PickupWindow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    label: '',
    pickup_date: '',
    start_time: '',
    end_time: '',
    max_slots: 999,
  });

  useEffect(() => {
    loadWindows();
  }, []);

  const loadWindows = async () => {
    const res = await fetch('/api/admin/pickup-windows');
    const data = await res.json();
    setWindows(data);
  };

  const handleSave = async () => {
    const res = await fetch('/api/admin/pickup-windows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    if (res.ok) {
      setFormData({ label: '', pickup_date: '', start_time: '', end_time: '', max_slots: 999 });
      setShowForm(false);
      loadWindows();
    }
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    const res = await fetch(`/api/admin/pickup-windows/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !active }),
    });
    if (res.ok) loadWindows();
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/admin/pickup-windows?id=${id}`, { method: 'DELETE' });
    if (res.ok) loadWindows();
  };

  return (
    <AdminLayout title="Pickup Windows">
      <div className="flex justify-between items-center mb-6">
        <div />
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg"
        >
          + Add Window
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-100 p-4 rounded-lg mb-6 space-y-3">
          <input
            type="text"
            placeholder="Label (e.g. Morning Pickup)"
            value={formData.label}
            onChange={(e) => setFormData({ ...formData, label: e.target.value })}
            className="w-full px-3 py-2 border rounded"
          />
          <input
            type="date"
            value={formData.pickup_date}
            onChange={(e) => setFormData({ ...formData, pickup_date: e.target.value })}
            className="w-full px-3 py-2 border rounded"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="time"
              value={formData.start_time}
              onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
              className="px-3 py-2 border rounded"
            />
            <input
              type="time"
              value={formData.end_time}
              onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
              className="px-3 py-2 border rounded"
            />
          </div>
          <input
            type="number"
            placeholder="Max Slots"
            value={formData.max_slots}
            onChange={(e) => setFormData({ ...formData, max_slots: parseInt(e.target.value) })}
            className="w-full px-3 py-2 border rounded"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded"
            >
              Save
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="flex-1 px-4 py-2 bg-gray-400 text-white rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-200">
              <th className="border px-4 py-2 text-left">Date</th>
              <th className="border px-4 py-2 text-left">Time</th>
              <th className="border px-4 py-2 text-left">Label</th>
              <th className="border px-4 py-2 text-left">Max Slots</th>
              <th className="border px-4 py-2 text-left">Active</th>
              <th className="border px-4 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {windows.map((w) => (
              <tr key={w.id} className="hover:bg-gray-100">
                <td className="border px-4 py-2">{format(new Date(w.pickup_date), 'EEE, MMM d')}</td>
                <td className="border px-4 py-2">
                  {w.start_time} – {w.end_time}
                </td>
                <td className="border px-4 py-2">{w.label}</td>
                <td className="border px-4 py-2">{w.max_slots}</td>
                <td className="border px-4 py-2">
                  <input
                    type="checkbox"
                    checked={w.active}
                    onChange={() => handleToggleActive(w.id, w.active)}
                  />
                </td>
                <td className="border px-4 py-2">
                  <button
                    onClick={() => handleDelete(w.id)}
                    className="px-2 py-1 bg-red-600 text-white rounded text-sm"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}

'use client';
import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';

interface Coupon {
  id: string;
  code: string;
  type: string;
  value: number;
  expires_at: string;
  redeemed: boolean;
  single_use: boolean;
  created_at: string;
}

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    type: 'fixed_amount',
    value: 0,
    expires_at: '',
    single_use: true,
  });
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await fetch('/api/admin/coupons');
    const data = await res.json();
    setCoupons(data);
    setLoading(false);
  }

  async function handleCreate() {
    setCreating(true);
    await fetch('/api/admin/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,
        value: parseFloat(String(formData.value)),
      }),
    });
    setCreating(false);
    setShowModal(false);
    setFormData({ code: '', type: 'fixed_amount', value: 0, expires_at: '', single_use: true });
    load();
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    await fetch('/api/admin/coupons', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setDeleting(false);
    setDeleteId(null);
    load();
  }

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

  if (loading) {
    return <AdminLayout title="Coupons"><div>Loading...</div></AdminLayout>;
  }

  return (
    <AdminLayout title="Coupons">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div />
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            + Create Coupon
          </button>
        </div>

        {coupons.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No coupons yet — create your first one
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Value</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Expires</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Used</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Active</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {coupons.map(c => {
                  const expired = isExpired(c.expires_at);
                  const active = !expired && !c.redeemed;
                  return (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-semibold">{c.code}</td>
                      <td className="px-6 py-4 text-sm">{c.type}</td>
                      <td className="px-6 py-4 text-sm">
                        {c.type.includes('percent') ? `${c.value}%` : `$${c.value.toFixed(2)}`}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(c.expires_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            c.redeemed
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {c.redeemed ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <button
                          onClick={() => setDeleteId(c.id)}
                          className="text-red-600 hover:underline font-medium"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <p className="text-lg font-semibold mb-4">Create Coupon</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value.toUpperCase() })
                  }
                  placeholder="e.g., SUMMER20"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="fixed_amount">Fixed Amount ($)</option>
                  <option value="percentage">Percentage (%)</option>
                  <option value="waive_deposit">Waive Deposit</option>
                  <option value="percent_off_balance">% Off Balance</option>
                </select>
              </div>
              {(formData.type === 'fixed_amount' || formData.type === 'percentage') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
                  <input
                    type="number"
                    value={formData.value}
                    onChange={(e) =>
                      setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })
                    }
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expires At
                </label>
                <input
                  type="date"
                  value={formData.expires_at}
                  onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.single_use}
                  onChange={(e) => setFormData({ ...formData, single_use: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">Single Use</span>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded text-gray-700 font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !formData.code}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm">
            <p className="text-lg font-semibold mb-4">Delete Coupon?</p>
            <p className="text-gray-600 mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded text-gray-700 font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

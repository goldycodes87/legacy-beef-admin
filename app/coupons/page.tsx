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
          <div className="text-center py-12 text-gray-400">
            No coupons yet — create your first one
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table
              className="w-full border rounded-xl overflow-hidden"
              style={{ borderColor: 'var(--border)' }}
            >
              <thead style={{ background: 'var(--surface-2)' }}>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-white">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-white">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-white">Value</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-white">Expires</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-white">Used</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-white">Active</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-white">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {coupons.map(c => {
                  const expired = isExpired(c.expires_at);
                  const active = !expired && !c.redeemed;
                  return (
                    <tr key={c.id} className="hover:bg-white/5">
                      <td className="px-6 py-4 text-sm font-semibold text-white">{c.code}</td>
                      <td className="px-6 py-4 text-sm text-gray-300">{c.type}</td>
                      <td className="px-6 py-4 text-sm text-gray-300">
                        {c.type.includes('percent') ? `${c.value}%` : `$${c.value.toFixed(2)}`}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400">
                        {new Date(c.expires_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            c.redeemed
                              ? 'bg-green-500/20 text-green-300'
                              : 'bg-white/10 text-white'
                          }`}
                        >
                          {c.redeemed ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            active
                              ? 'bg-green-500/20 text-green-300'
                              : 'bg-red-500/20 text-red-300'
                          }`}
                        >
                          {active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <button
                          onClick={() => setDeleteId(c.id)}
                          className="text-red-400 hover:underline font-medium"
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div
            className="rounded-lg p-6 max-w-sm w-full mx-4 border"
            style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
          >
            <p className="text-lg font-semibold mb-4 text-white">Create Coupon</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Code</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value.toUpperCase() })
                  }
                  placeholder="e.g., SUMMER20"
                  className="w-full px-3 py-2 rounded-lg text-sm bg-transparent text-white"
                  style={{ borderColor: 'var(--border)', borderWidth: 1 }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm bg-transparent text-white"
                  style={{ borderColor: 'var(--border)', borderWidth: 1 }}
                >
                  <option value="fixed_amount">Fixed Amount ($)</option>
                  <option value="percentage">Percentage (%)</option>
                  <option value="waive_deposit">Waive Deposit</option>
                  <option value="percent_off_balance">% Off Balance</option>
                </select>
              </div>
              {(formData.type === 'fixed_amount' || formData.type === 'percentage') && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Value</label>
                  <input
                    type="number"
                    value={formData.value}
                    onChange={(e) =>
                      setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })
                    }
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-lg text-sm bg-transparent text-white"
                    style={{ borderColor: 'var(--border)', borderWidth: 1 }}
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Expires At
                </label>
                <input
                  type="date"
                  value={formData.expires_at}
                  onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm bg-transparent text-white"
                  style={{ borderColor: 'var(--border)', borderWidth: 1 }}
                />
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.single_use}
                  onChange={(e) => setFormData({ ...formData, single_use: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-gray-300">Single Use</span>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 rounded text-white font-medium"
                style={{ borderColor: 'var(--border)', borderWidth: 1 }}
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div
            className="rounded-lg p-6 max-w-sm w-full border"
            style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
          >
            <p className="text-lg font-semibold mb-4 text-white">Delete Coupon?</p>
            <p className="text-gray-300 mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 px-4 py-2 rounded text-white font-medium"
                style={{ borderColor: 'var(--border)', borderWidth: 1 }}
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

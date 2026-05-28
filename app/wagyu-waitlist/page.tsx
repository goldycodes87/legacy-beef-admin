'use client';
import { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';

interface WaitlistEntry {
  id: string;
  customer_name: string;
  email: string;
  phone: string | null;
  size_preference: string;
  status: string;
  created_at: string;
}

export default function WagyuWaitlist() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/wagyu-waitlist')
      .then(r => r.json())
      .then(data => {
        setEntries(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, []);

  return (
    <AdminLayout title="Wagyu Waitlist">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-white">Wagyu Waitlist</h1>
          <span className="bg-purple-500/20 text-purple-200 px-3 py-1 rounded-full text-sm font-semibold">
            {entries.length} waiting
          </span>
        </div>
        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : entries.length === 0 ? (
          <p className="text-gray-400">No waitlist entries yet.</p>
        ) : (
          <div
            className="rounded-2xl shadow-sm overflow-hidden border"
            style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
          >
            <table className="w-full">
              <thead className="border-b" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-300 uppercase">Name</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-300 uppercase">Email</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-300 uppercase">Phone</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-300 uppercase">Size</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-300 uppercase">Date</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-300 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {entries.map(entry => (
                  <tr key={entry.id} className="hover:bg-white/5">
                    <td className="px-6 py-4 text-sm font-medium text-white">{entry.customer_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-300">{entry.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-300">{entry.phone || '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-300 capitalize">{entry.size_preference}</td>
                    <td className="px-6 py-4 text-sm text-gray-300">
                      {new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-200 capitalize">
                        {entry.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

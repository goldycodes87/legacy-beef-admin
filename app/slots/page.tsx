'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';

interface Reservation {
  id: string;
  customer_name: string;
  purchase_type: string;
  status: string;
  deposit_paid: boolean;
  cut_sheet_complete: boolean;
  created_at: string;
}

interface AnimalGroup {
  animal: { name: string; butcher_date: string };
  sessions: Reservation[];
}

export default function SlotsPage() {
  const [slots, setSlots] = useState<Record<string, AnimalGroup>>({});
  const [loading, setLoading] = useState(true);

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
    </AdminLayout>
  );
}

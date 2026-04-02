'use client';
import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';

interface Session {
  id: string;
  customer_id: string;
  animal_id: string;
  purchase_type: string;
  status: string;
  deposit_paid: boolean;
  cut_sheet_complete: boolean;
  created_at: string;
  animals: { name: string; butcher_date: string; animal_type: string } | null;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  created_at: string;
  sessions: Session[];
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/admin/customers');
      const data = await res.json();
      setCustomers(data);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  const getActiveSessions = (c: Customer) =>
    c.sessions?.filter(
      s => s.status !== 'cancelled' && !(s.status === 'draft' && !s.deposit_paid)
    ) || [];

  const lastOrder = (c: Customer) => {
    const active = getActiveSessions(c);
    if (active.length === 0) return '—';
    const latest = active[0];
    return new Date(latest.created_at).toLocaleDateString();
  };

  if (loading) {
    return <AdminLayout title="Customers"><div>Loading...</div></AdminLayout>;
  }

  return (
    <AdminLayout title="Customers">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">{customers.length} customers total</p>
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg w-80"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No customers yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">City/State</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Orders</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Last Order</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map(c => (
                  <>
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium">{c.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{c.email}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{c.phone}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{c.city}, {c.state}</td>
                      <td className="px-6 py-4 text-sm font-medium">{getActiveSessions(c).length}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{lastOrder(c)}</td>
                      <td className="px-6 py-4 text-sm">
                        <button
                          onClick={() =>
                            setExpandedCustomer(expandedCustomer === c.id ? null : c.id)
                          }
                          className="text-blue-600 hover:underline font-medium"
                        >
                          {expandedCustomer === c.id ? 'Hide' : 'View'}
                        </button>
                      </td>
                    </tr>
                    {expandedCustomer === c.id && (
                      <tr>
                        <td colSpan={7} className="px-6 py-4 bg-gray-50">
                          <div className="space-y-3">
                            <p className="font-semibold text-gray-900">Sessions:</p>
                            {getActiveSessions(c).map(s => (
                              <div
                                key={s.id}
                                className="bg-white border border-gray-200 rounded p-3 text-sm"
                              >
                                <p className="font-medium">
                                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs mr-2">
                                    {s.purchase_type}
                                  </span>
                                  <span className="font-medium">
                                    {s.animals?.name || 'Unknown'}
                                  </span>
                                  <span className="text-gray-500 text-xs ml-1">
                                    • Butcher {s.animals?.butcher_date
                                      ? new Date(s.animals.butcher_date + 'T00:00:00').toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})
                                      : 'TBD'}
                                  </span>
                                </p>
                                <p className="text-gray-600 mt-1">
                                  Status:{' '}
                                  <span className="font-semibold capitalize">{s.status}</span>
                                </p>
                                <p className="text-gray-600">
                                  Deposit:{' '}
                                  {s.deposit_paid ? (
                                    <span className="text-green-600 font-semibold">✓ Deposit Paid</span>
                                  ) : (
                                    <span className="text-red-500 font-semibold">✗ Deposit Pending</span>
                                  )}
                                </p>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

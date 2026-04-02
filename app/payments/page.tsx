'use client';
import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';

interface Payment {
  id: string;
  type: string;
  status: string;
  method: string;
  amount_cents: number;
  paid_at: string;
  stripe_payment_intent_id: string;
  session_id: string;
  sessions: {
    id: string;
    purchase_type: string;
    deposit_amount: number;
    balance_due: number;
    balance_paid: boolean;
    balance_payment_method: string;
    customers: { name: string; email: string; phone: string } | null;
    animals: { name: string; butcher_date: string; animal_type: string } | null;
  };
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmModal, setConfirmModal] = useState<{ sessionId: string; method: string } | null>(
    null
  );
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await fetch('/api/admin/payments');
    const data = await res.json();
    setPayments(data);
    setLoading(false);
  }

  const totalDeposits = payments
    .filter(p => p.status === 'paid' || p.status === 'succeeded')
    .reduce((sum, p) => sum + p.amount_cents, 0) / 100;

  const outstandingBalances = payments.filter(
    p => p.sessions?.balance_due > 0 && !p.sessions?.balance_paid
  ).length;

  const balancesCollected = payments
    .filter(p => p.sessions?.balance_paid)
    .reduce((sum, p) => sum + (p.sessions?.balance_due || 0), 0);

  const cashCheckPending = payments.filter(
    p =>
      p.method === 'cash_check' && !p.sessions?.balance_paid
  ).length;

  async function handleMarkPaid(sessionId: string, method: string) {
    setMarking(true);
    await fetch('/api/admin/payments', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, method }),
    });
    setConfirmModal(null);
    setMarking(false);
    load();
  }

  if (loading) {
    return <AdminLayout title="Payments"><div>Loading...</div></AdminLayout>;
  }

  return (
    <AdminLayout title="Payments">
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-600 font-semibold mb-1">Total Deposits Collected</p>
            <p className="text-2xl font-bold text-gray-900">${totalDeposits.toLocaleString()}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-600 font-semibold mb-1">Outstanding Balances</p>
            <p className="text-2xl font-bold text-gray-900">{outstandingBalances}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-600 font-semibold mb-1">Balances Collected</p>
            <p className="text-2xl font-bold text-gray-900">
              ${balancesCollected.toLocaleString()}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-600 font-semibold mb-1">Cash/Check Pending</p>
            <p className="text-2xl font-bold text-gray-900">{cashCheckPending}</p>
          </div>
        </div>

        {/* Payments Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Animal</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Type</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Deposit</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">
                  Balance Due
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Paid</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Method</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {payments.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium">
                    {p.sessions?.customers?.name || '—'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {p.sessions?.animals?.name || '—'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                      {p.sessions?.purchase_type || '—'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium">
                    ${(p.sessions?.deposit_amount || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium">
                    ${(p.sessions?.balance_due || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {p.status === 'paid' || p.status === 'succeeded' ? (
                      <span className="text-green-600 font-semibold">✓</span>
                    ) : (
                      <span className="text-red-600 font-semibold">
                        ${(p.sessions?.balance_due || 0).toFixed(2)}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {p.method ? (
                      <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs">
                        {p.sessions.balance_payment_method === 'cash_check'
                          ? 'Cash/Check'
                          : p.sessions.balance_payment_method === 'stripe'
                            ? 'Stripe'
                            : p.sessions.balance_payment_method}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {p.sessions?.balance_due > 0 && !p.sessions?.balance_paid ? (
                      <div className="relative group">
                        <button className="text-blue-600 hover:underline font-medium text-xs">
                          Mark Paid ▼
                        </button>
                        <div className="hidden group-hover:block absolute bg-white border border-gray-200 rounded shadow-lg z-10 mt-1">
                          {['Stripe', 'ACH', 'Cash/Check'].map(method => (
                            <button
                              key={method}
                              onClick={() => setConfirmModal({ sessionId: p.session_id, method })}
                              className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 first:rounded-t last:rounded-b"
                            >
                              {method}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirm Modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm">
            <p className="text-lg font-semibold mb-4">Confirm Payment</p>
            <p className="text-gray-600 mb-6">
              Mark balance as paid via <strong>{confirmModal.method}</strong>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded text-gray-700 font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleMarkPaid(confirmModal.sessionId, confirmModal.method)}
                disabled={marking}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {marking ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

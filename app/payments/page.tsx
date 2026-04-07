'use client';

import { useEffect, useState } from 'react';

interface PaymentRecord {
  session_id: string;
  customer_name: string;
  animal_name: string;
  butcher_date: string;
  purchase_type: string;
  deposit_amount_cents: number | null;
  deposit_paid_at: string | null;
  deposit_method: string | null;
  balance_due: number;
  balance_paid: boolean;
  balance_paid_at: string | null;
  balance_payment_method: string | null;
}

export default function PaymentsPage() {
  const [records, setRecords] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    const res = await fetch('/api/admin/payments');
    const data = await res.json();
    // Sort by butcher_date, then customer_name
    data.sort((a: PaymentRecord, b: PaymentRecord) => {
      const dateA = new Date(a.butcher_date || '').getTime();
      const dateB = new Date(b.butcher_date || '').getTime();
      if (dateA !== dateB) return dateA - dateB;
      return a.customer_name.localeCompare(b.customer_name);
    });
    setRecords(data);
    setLoading(false);
  };

  // Calculate summary stats
  const totalDeposits = records.reduce((sum, r) => 
    sum + (r.deposit_amount_cents || 0), 0) / 100;

  const outstandingBalances = records.filter(r => 
    r.balance_due > 0 && !r.balance_paid).length;

  const balancesCollected = records.reduce((sum, r) => 
    sum + (r.balance_paid ? (r.balance_due || 0) : 0), 0);

  const totalRevenue = totalDeposits + balancesCollected;

  const formatCurrency = (cents: number | null) => {
    if (cents === null || cents === undefined) return '$0.00';
    return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  const formatPurchaseType = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1) + ' Beef';
  };

  const formatPaymentMethod = (method: string | null) => {
    if (!method) return '—';
    if (method === 'card') return '💳 Card';
    if (method === 'cash') return '💵 Cash';
    if (method === 'check') return '📄 Check';
    return method;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) return <div className="p-6 text-center">Loading...</div>;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Payments</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-6 border-t-4 border-green-500">
          <p className="text-sm text-gray-600 mb-2">Total Deposits Collected</p>
          <p className="text-3xl font-bold text-gray-900">
            {formatCurrency(totalDeposits * 100)}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-t-4 border-amber-500">
          <p className="text-sm text-gray-600 mb-2">Outstanding Balances</p>
          <p className="text-3xl font-bold text-gray-900">{outstandingBalances}</p>
          <p className="text-xs text-gray-500 mt-1">sessions</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-t-4 border-blue-500">
          <p className="text-sm text-gray-600 mb-2">Balances Collected</p>
          <p className="text-3xl font-bold text-gray-900">
            {formatCurrency(balancesCollected * 100)}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-t-4 border-brand-orange">
          <p className="text-sm text-gray-600 mb-2">Total Revenue</p>
          <p className="text-3xl font-bold text-gray-900">
            {formatCurrency(totalRevenue * 100)}
          </p>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Customer</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Animal</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Type</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Deposit Paid</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Deposit Method</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Balance Due</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Balance Paid</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Balance Method</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record, idx) => (
              <tr key={record.session_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-6 py-4 text-sm text-gray-900">{record.customer_name}</td>
                <td className="px-6 py-4 text-sm text-gray-900">{record.animal_name}</td>
                <td className="px-6 py-4 text-sm">
                  <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">
                    {formatPurchaseType(record.purchase_type)}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm">
                  {record.deposit_amount_cents && record.deposit_amount_cents > 0 ? (
                    <div>
                      <p className="text-green-600 font-semibold">✓ {formatCurrency(record.deposit_amount_cents)}</p>
                      <p className="text-xs text-gray-500">{formatDate(record.deposit_paid_at)}</p>
                    </div>
                  ) : (
                    <p className="text-red-600 font-semibold">✗ Not Paid</p>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {formatPaymentMethod(record.deposit_method)}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900 font-semibold">
                  {record.balance_due > 0 ? formatCurrency(record.balance_due * 100) : 'TBD'}
                </td>
                <td className="px-6 py-4 text-sm">
                  {record.balance_paid ? (
                    <div>
                      <p className="text-green-600 font-semibold">✓ {formatCurrency(record.balance_due * 100)}</p>
                      <p className="text-xs text-gray-500">{formatDate(record.balance_paid_at)}</p>
                    </div>
                  ) : record.balance_due > 0 ? (
                    <p className="text-amber-600 font-semibold">Pending</p>
                  ) : (
                    <p className="text-gray-400">—</p>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {formatPaymentMethod(record.balance_payment_method)}
                </td>
              </tr>
            ))}
            
            {/* Summary Row */}
            <tr className="bg-gray-100 border-t-2 font-bold">
              <td colSpan={3} className="px-6 py-4 text-sm text-gray-900">Totals</td>
              <td className="px-6 py-4 text-sm text-green-600">{formatCurrency(totalDeposits * 100)}</td>
              <td></td>
              <td className="px-6 py-4 text-sm text-gray-900">{formatCurrency(balancesCollected * 100)}</td>
              <td></td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

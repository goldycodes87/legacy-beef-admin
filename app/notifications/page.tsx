'use client';
import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';

interface Notification {
  id: string;
  type: string;
  channel: string;
  status: string;
  sent_at: string;
  sessions: { customers: { name: string; email: string } | null } | null;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    target: 'all',
    channel: 'email',
    subject: '',
    message: '',
    butcher_date: '',
    customer_search: '',
  });
  const [sending, setSending] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [customers, setCustomers] = useState<{
    id: string;
    name: string;
    email: string;
    sessions: { id: string }[];
  }[]>([]);
  const [butcherDates, setButcherDates] = useState<{
    id: string;
    butcher_date: string;
    animal_type: string;
  }[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  async function loadAll() {
    const [notifRes, custRes, dateRes] = await Promise.all([
      fetch('/api/admin/notifications'),
      fetch('/api/admin/customers'),
      fetch('/api/admin/animals'),
    ]);
    const notifData = await notifRes.json();
    const custData = await custRes.json();
    const dateData = await dateRes.json();
    setNotifications(notifData);
    setCustomers(custData);
    setButcherDates(dateData);
    setLoading(false);
  }

  async function load() {
    const res = await fetch('/api/admin/notifications');
    const data = await res.json();
    setNotifications(data);
  }

  useEffect(() => {
    loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSend() {
    setSending(true);
    let target = formData.target;

    if (target === 'butcher_date' && selectedDate) {
      target = `butcher_date:${selectedDate}`;
    } else if (target === 'customer' && selectedCustomer) {
      // selectedCustomer is the customer ID, need to find their session ID
      const selectedCust = customers.find(c => c.id === selectedCustomer);
      const sessionId = selectedCust?.sessions?.[0]?.id;

      if (!sessionId) {
        alert('This customer has no active reservations.');
        setSending(false);
        return;
      }

      target = `session:${sessionId}`;
    }

    const res = await fetch('/api/admin/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target,
        channel: formData.channel,
        subject: formData.subject,
        message: formData.message,
      }),
    });

    const result = await res.json();
    if (result.success) {
      setSuccessMessage(`Notification queued for ${result.sent_to} customers`);
      setFormData({
        target: 'all',
        channel: 'email',
        subject: '',
        message: '',
        butcher_date: '',
        customer_search: '',
      });
      setSelectedCustomer('');
      setSelectedDate('');
      setTimeout(() => setSuccessMessage(''), 3000);
      loadAll();
    }
    setSending(false);
  }

  if (loading) {
    return <AdminLayout title="Notifications"><div>Loading...</div></AdminLayout>;
  }

  return (
    <AdminLayout title="Notifications">
      <div className="space-y-8">
        {/* Send Notification Form */}
        <div
          className="rounded-lg p-6 border"
          style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
        >
          <p className="text-lg font-semibold mb-4 text-white">Send Notification</p>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Target</label>
                <select
                  value={formData.target}
                  onChange={(e) => setFormData({ ...formData, target: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm bg-transparent text-white"
                  style={{ borderColor: 'var(--border)', borderWidth: 1 }}
                >
                  <option value="all">All customers with deposits</option>
                  <option value="pending_cut_sheets">Customers with pending cut sheets</option>
                  <option value="butcher_date">Specific butcher date</option>
                  <option value="customer">Individual customer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Channel</label>
                <select
                  value={formData.channel}
                  onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm bg-transparent text-white"
                  style={{ borderColor: 'var(--border)', borderWidth: 1 }}
                >
                  <option value="email">Email</option>
                  <option value="sms">SMS (placeholder)</option>
                </select>
              </div>
            </div>

            {formData.target === 'butcher_date' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Butcher Date
                </label>
                <select
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-sm bg-transparent text-white"
                  style={{ borderColor: 'var(--border)', borderWidth: 1 }}
                >
                  <option value="">Select a butcher date...</option>
                  {butcherDates.map(a => (
                    <option key={a.id} value={a.butcher_date}>
                      {new Date(a.butcher_date + 'T00:00:00').toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}{' '}
                      — {a.animal_type?.replace(/_/g, '-').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {formData.target === 'customer' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Customer
                </label>
                <select
                  value={selectedCustomer}
                  onChange={(e) => setSelectedCustomer(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-sm bg-transparent text-white"
                  style={{ borderColor: 'var(--border)', borderWidth: 1 }}
                >
                  <option value="">Select a customer...</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Subject</label>
              <input
                type="text"
                placeholder="Email subject line"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm bg-transparent text-white"
                style={{ borderColor: 'var(--border)', borderWidth: 1 }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Message ({formData.message.length}/500)
              </label>
              <textarea
                value={formData.message}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    message: e.target.value.slice(0, 500),
                  })
                }
                placeholder="Type your message..."
                rows={4}
                className="w-full px-3 py-2 rounded-lg text-sm bg-transparent text-white"
                style={{ borderColor: 'var(--border)', borderWidth: 1 }}
              />
            </div>

            {successMessage && (
              <div className="bg-green-500/10 border border-green-500/30 rounded p-3 text-sm text-green-200">
                {successMessage}
              </div>
            )}

            <button
              onClick={handleSend}
              disabled={
                sending ||
                !formData.subject ||
                !formData.message ||
                (formData.target === 'butcher_date' && !selectedDate) ||
                (formData.target === 'customer' && !selectedCustomer)
              }
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {sending ? 'Sending...' : 'Send Notification'}
            </button>
          </div>
        </div>

        {/* Notification History */}
        <div
          className="rounded-lg p-6 border"
          style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
        >
          <p className="text-lg font-semibold mb-4 text-white">Notification History</p>
          {notifications.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No notifications sent yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold text-white">Type</th>
                    <th className="px-6 py-3 text-left font-semibold text-white">Channel</th>
                    <th className="px-6 py-3 text-left font-semibold text-white">Customer</th>
                    <th className="px-6 py-3 text-left font-semibold text-white">Status</th>
                    <th className="px-6 py-3 text-left font-semibold text-white">Sent At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {notifications.map(n => (
                    <tr key={n.id} className="hover:bg-white/5">
                      <td className="px-6 py-3 font-medium capitalize text-white">{n.type}</td>
                      <td className="px-6 py-3 capitalize text-gray-300">{n.channel}</td>
                      <td className="px-6 py-3 text-gray-200">{n.sessions?.customers?.name || '—'}</td>
                      <td className="px-6 py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            n.status === 'queued'
                              ? 'bg-white/10 text-white'
                              : n.status === 'sent'
                                ? 'bg-green-500/20 text-green-300'
                                : 'bg-red-500/20 text-red-300'
                          }`}
                        >
                          {n.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-400">
                        {new Date(n.sent_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
